import express, { type Request, type Response } from "express";
import { storage as db } from "./storage";
import { authMiddleware } from "./auth";
import multer from "multer";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import { and, eq, isNull, desc, sql } from "drizzle-orm";
import { db as drizzleDb } from "./db";
import * as schema from "@shared/schema";

// ─── File Upload Setup ────────────────────────────────────────────────────────
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

function getMulter(subdir: string, maxSizeMB: number = 5) {
  const dir = path.join(uploadDir, subdir);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return multer({
    storage: multer.diskStorage({
      destination: (_, __, cb) => cb(null, dir),
      filename: (_, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${randomUUID()}${ext}`);
      },
    }),
    limits: { fileSize: maxSizeMB * 1024 * 1024 },
    fileFilter: (_, file, cb) => {
      const allowed = [".jpg", ".jpeg", ".png", ".webp", ".pdf", ".doc", ".docx"];
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, allowed.includes(ext));
    },
  });
}

function fileUrl(subdir: string, filename: string) {
  return `/uploads/${subdir}/${filename}`;
}

// ─── Helper Functions ────────────────────────────────────────────────────────
function formatNewsResponse(news: any) {
  return {
    id: news.id,
    title: news.title,
    slug: news.slug,
    excerpt: news.excerpt,
    content: news.content,
    featured_image: news.featuredImage,
    featured_caption: news.featuredCaption,
    category: news.category,
    category_id: news.categoryId,
    published_at: news.publishedAt,
    view_count: news.viewCount,
    author: news.author,
    created_at: news.createdAt,
  };
}

function formatDocumentResponse(doc: any) {
  return {
    id: doc.id,
    title: doc.title,
    doc_no: doc.docNo,
    kind: doc.kind,
    kind_id: doc.kindId,
    category: doc.category,
    category_id: doc.categoryId,
    type: doc.type,
    type_id: doc.typeId,
    publisher: doc.publisher,
    file_url: doc.fileUrl,
    access_level: doc.accessLevel,
    published_at: doc.publishedAt,
    description: doc.content,
    created_at: doc.createdAt,
  };
}

// ─── Main Router Setup ────────────────────────────────────────────────────────
export function registerFlutterApiRoutes(app: express.Express) {
  const flutterRouter = express.Router();
  
  // ==================== PUBLIC API (No Auth Required) ====================
  
  /**
   * @route   GET /api/flutter/v1/banners
   * @desc    Get active banners
   * @access  Public
   */
  flutterRouter.get("/v1/banners", async (req: Request, res: Response) => {
    try {
      const banners = await db.getActiveBanners();
      
      // Track view (optional)
      banners.forEach(banner => {
        db.trackBannerView(banner.id).catch(() => {});
      });
      
      const formattedBanners = banners.map(banner => ({
        id: banner.id,
        title: banner.title,
        image_desktop: banner.imageDesktop,
        image_mobile: banner.imageMobile || banner.imageDesktop,
        alt_text: banner.altText,
        link_type: banner.linkType,
        link_url: banner.linkUrl,
        target: banner.target,
      }));
      
      return res.json({
        success: true,
        data: formattedBanners,
        message: "Banners retrieved successfully"
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: "Failed to retrieve banners",
        error: error.message
      });
    }
  });

  /**
   * @route   GET /api/flutter/v1/news
   * @desc    Get news list with pagination
   * @access  Public
   */
  flutterRouter.get("/v1/news", async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const categoryId = req.query.category_id as string;
      const search = req.query.search as string;
      
      const result = await db.listNews({
        page,
        limit,
        categoryId,
        search,
        status: "published"
      });
      
      // Get categories for each news
      const items = await Promise.all(result.items.map(async (item) => {
        let category = null;
        if (item.categoryId) {
          category = await db.getNewsCategory(item.categoryId);
        }
        
        return {
          id: item.id,
          title: item.title,
          slug: item.slug,
          excerpt: item.excerpt,
          featured_image: item.featuredImage,
          category: category ? { id: category.id, name: category.name, slug: category.slug } : null,
          published_at: item.publishedAt,
          view_count: item.viewCount,
          created_at: item.createdAt,
        };
      }));
      
      return res.json({
        success: true,
        data: {
          items,
          total: result.total,
          page,
          limit,
          total_pages: Math.ceil(result.total / limit)
        },
        message: "News retrieved successfully"
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: "Failed to retrieve news",
        error: error.message
      });
    }
  });

  /**
   * @route   GET /api/flutter/v1/news/:slug
   * @desc    Get news detail by slug
   * @access  Public
   */
  flutterRouter.get("/v1/news/:slug", async (req: Request, res: Response) => {
    try {
      const { slug } = req.params;
      
      const news = await db.getNewsBySlug(slug);
      if (!news) {
        return res.status(404).json({
          success: false,
          message: "News not found"
        });
      }
      
      // Increment view count
      await db.updateNews(news.id, { viewCount: (news.viewCount || 0) + 1 });
      
      // Get category
      let category = null;
      if (news.categoryId) {
        category = await db.getNewsCategory(news.categoryId);
      }
      
      // Get author
      let author = null;
      if (news.authorId) {
        const user = await db.getUser(news.authorId);
        if (user) {
          author = {
            id: user.id,
            name: user.fullName,
            username: user.username,
          };
        }
      }
      
      // Get news media (images)
      const media = await db.listNewsMedia(news.id);
      
      const formattedNews = {
        id: news.id,
        title: news.title,
        slug: news.slug,
        excerpt: news.excerpt,
        content: news.content,
        featured_image: news.featuredImage,
        featured_caption: news.featuredCaption,
        category: category ? { id: category.id, name: category.name, slug: category.slug } : null,
        author,
        media: media.map(m => ({
          id: m.id,
          file_url: m.fileUrl,
          caption: m.caption,
          is_main: m.isMain,
          type: m.type,
        })),
        published_at: news.publishedAt,
        view_count: news.viewCount,
        created_at: news.createdAt,
      };
      
      return res.json({
        success: true,
        data: formattedNews,
        message: "News detail retrieved successfully"
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: "Failed to retrieve news detail",
        error: error.message
      });
    }
  });

  /**
   * @route   POST /api/flutter/v1/news/:slug/view
   * @desc    Track news view (alternative endpoint)
   * @access  Public
   */
  flutterRouter.post("/v1/news/:slug/view", async (req: Request, res: Response) => {
    try {
      const { slug } = req.params;
      
      const news = await db.getNewsBySlug(slug);
      if (!news) {
        return res.status(404).json({
          success: false,
          message: "News not found"
        });
      }
      
      await db.updateNews(news.id, { viewCount: (news.viewCount || 0) + 1 });
      
      const updatedNews = await db.getNews(news.id);
      
      return res.json({
        success: true,
        data: { view_count: updatedNews?.viewCount || 0 },
        message: "View tracked successfully"
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: "Failed to track view",
        error: error.message
      });
    }
  });

  /**
   * @route   GET /api/flutter/v1/news-categories
   * @desc    Get news categories
   * @access  Public
   */
  flutterRouter.get("/v1/news-categories", async (req: Request, res: Response) => {
    try {
      const categories = await db.listNewsCategories();
      
      return res.json({
        success: true,
        data: categories.map(cat => ({
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
          description: cat.description,
        })),
        message: "News categories retrieved successfully"
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: "Failed to retrieve news categories",
        error: error.message
      });
    }
  });

  /**
   * @route   GET /api/flutter/v1/document-categories
   * @desc    Get document categories
   * @access  Public
   */
  flutterRouter.get("/v1/document-categories", async (req: Request, res: Response) => {
    try {
      const categories = await db.listDocumentCategories();
      const kinds = await db.listDocumentKinds();
      const types = await db.listDocumentTypes();
      
      return res.json({
        success: true,
        data: {
          categories: categories.map(c => ({ id: c.id, name: c.name })),
          kinds: kinds.map(k => ({ id: k.id, name: k.name })),
          types: types.map(t => ({ id: t.id, name: t.name, extension: t.extension })),
        },
        message: "Document categories retrieved successfully"
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: "Failed to retrieve document categories",
        error: error.message
      });
    }
  });

  /**
   * @route   GET /api/flutter/v1/documents
   * @desc    Get documents list with filters
   * @access  Public
   */
  flutterRouter.get("/v1/documents", async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const categoryId = req.query.category_id as string;
      const kindId = req.query.kind_id as string;
      const typeId = req.query.type_id as string;
      const search = req.query.search as string;
      
      const result = await db.listDocuments({
        page,
        limit,
        categoryId,
        kindId,
        typeId,
        search,
        trash: false,
      });
      
      // Filter hanya yang published
      const publishedItems = result.items.filter(item => item.status === "published");
      
      // Get additional info for each document
      const items = await Promise.all(publishedItems.map(async (item) => {
        let category = null;
        let kind = null;
        let type = null;
        
        if (item.categoryId) {
          const cat = await db.listDocumentCategories();
          category = cat.find(c => c.id === item.categoryId) || null;
        }
        
        if (item.kindId) {
          const k = await db.listDocumentKinds();
          kind = k.find(k => k.id === item.kindId) || null;
        }
        
        if (item.typeId) {
          const t = await db.listDocumentTypes();
          type = t.find(t => t.id === item.typeId) || null;
        }
        
        return {
          id: item.id,
          title: item.title,
          doc_no: item.docNo,
          category: category ? { id: category.id, name: category.name } : null,
          kind: kind ? { id: kind.id, name: kind.name } : null,
          type: type ? { id: type.id, name: type.name, extension: type.extension } : null,
          publisher: item.publisher,
          file_url: item.fileUrl,
          access_level: item.accessLevel,
          published_at: item.publishedAt,
          description: item.content ? item.content.substring(0, 150) + '...' : null,
          created_at: item.createdAt,
        };
      }));
      
      return res.json({
        success: true,
        data: {
          items,
          total: publishedItems.length,
          page,
          limit,
          total_pages: Math.ceil(publishedItems.length / limit)
        },
        message: "Documents retrieved successfully"
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: "Failed to retrieve documents",
        error: error.message
      });
    }
  });

  /**
   * @route   GET /api/flutter/v1/documents/:id
   * @desc    Get document detail by ID
   * @access  Public
   */
  flutterRouter.get("/v1/documents/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      const document = await db.getDocument(id);
      if (!document) {
        return res.status(404).json({
          success: false,
          message: "Document not found"
        });
      }
      
      // Get additional info
      let category = null;
      let kind = null;
      let type = null;
      
      if (document.categoryId) {
        const cats = await db.listDocumentCategories();
        category = cats.find(c => c.id === document.categoryId) || null;
      }
      
      if (document.kindId) {
        const kinds = await db.listDocumentKinds();
        kind = kinds.find(k => k.id === document.kindId) || null;
      }
      
      if (document.typeId) {
        const types = await db.listDocumentTypes();
        type = types.find(t => t.id === document.typeId) || null;
      }
      
      const formattedDocument = {
        id: document.id,
        title: document.title,
        doc_no: document.docNo,
        category: category ? { id: category.id, name: category.name } : null,
        kind: kind ? { id: kind.id, name: kind.name } : null,
        type: type ? { id: type.id, name: type.name, extension: type.extension } : null,
        publisher: document.publisher,
        content: document.content,
        file_url: document.fileUrl,
        access_level: document.accessLevel,
        published_at: document.publishedAt,
        created_at: document.createdAt,
      };
      
      return res.json({
        success: true,
        data: formattedDocument,
        message: "Document detail retrieved successfully"
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: "Failed to retrieve document detail",
        error: error.message
      });
    }
  });

  // ==================== AUTH API (Public) ====================

  /**
   * @route   POST /api/flutter/v1/auth/login
   * @desc    User login
   * @access  Public
   */
  flutterRouter.post("/v1/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: "Email and password are required"
        });
      }
      
      const user = await db.getUserByEmail(email) || await db.getUserByUsername(email);
      
      if (!user || !user.isActive) {
        return res.status(401).json({
          success: false,
          message: "Invalid email or password"
        });
      }
      
      // Verify password (using bcrypt from auth.ts)
      const { verifyPassword, signToken } = await import("./auth");
      
      if (!verifyPassword(password, user.password)) {
        return res.status(401).json({
          success: false,
          message: "Invalid email or password"
        });
      }
      
      const token = signToken({ id: user.id, username: user.username, role: user.role });
      
      const { password: _, ...userWithoutPassword } = user;
      
      return res.json({
        success: true,
        data: {
          token,
          user: {
            id: userWithoutPassword.id,
            name: userWithoutPassword.fullName,
            email: userWithoutPassword.email,
            username: userWithoutPassword.username,
            role: userWithoutPassword.role,
            is_active: userWithoutPassword.isActive,
          }
        },
        message: "Login successful"
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: "Login failed",
        error: error.message
      });
    }
  });

  /**
   * @route   POST /api/flutter/v1/auth/register
   * @desc    User registration
   * @access  Public
   */
  flutterRouter.post("/v1/auth/register", async (req: Request, res: Response) => {
    try {
      const { name, email, password, username } = req.body;
      
      if (!name || !email || !password) {
        return res.status(400).json({
          success: false,
          message: "Name, email and password are required"
        });
      }
      
      // Check if user exists
      const existingUser = await db.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Email already registered"
        });
      }
      
      if (username) {
        const existingUsername = await db.getUserByUsername(username);
        if (existingUsername) {
          return res.status(400).json({
            success: false,
            message: "Username already taken"
          });
        }
      }
      
      // Hash password
      const { hashPassword } = await import("../auth");
      const hashedPassword = hashPassword(password);
      
      // Create user
      const finalUsername = username || email.split('@')[0] + Math.floor(Math.random() * 1000);
      
      const newUser = await db.createUser({
        username: finalUsername,
        email,
        password: hashedPassword,
        fullName: name,
        role: "user",
        isActive: true,
      });
      
      const { password: _, ...userWithoutPassword } = newUser;
      
      return res.status(201).json({
        success: true,
        data: {
          id: userWithoutPassword.id,
          name: userWithoutPassword.fullName,
          email: userWithoutPassword.email,
          username: userWithoutPassword.username,
        },
        message: "Registration successful"
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: "Registration failed",
        error: error.message
      });
    }
  });

  /**
   * @route   POST /api/flutter/v1/auth/forgot-password
   * @desc    Request password reset
   * @access  Public
   */
  flutterRouter.post("/v1/auth/forgot-password", async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({
          success: false,
          message: "Email is required"
        });
      }
      
      const user = await db.getUserByEmail(email);
      
      // Always return success even if email not found (security)
      if (user) {
        // Here you would typically:
        // 1. Generate reset token
        // 2. Save to database
        // 3. Send email with reset link
        
        // For now, just log
        console.log(`Password reset requested for: ${email}`);
      }
      
      return res.json({
        success: true,
        message: "If your email is registered, you will receive password reset instructions"
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: "Failed to process request",
        error: error.message
      });
    }
  });

  /**
   * @route   POST /api/flutter/v1/auth/reset-password
   * @desc    Reset password with token
   * @access  Public
   */
  flutterRouter.post("/v1/auth/reset-password", async (req: Request, res: Response) => {
    try {
      const { token, new_password } = req.body;
      
      if (!token || !new_password) {
        return res.status(400).json({
          success: false,
          message: "Token and new password are required"
        });
      }
      
      // Here you would:
      // 1. Verify token
      // 2. Find user by token
      // 3. Update password
      // 4. Invalidate token
      
      // For now, return success message
      return res.json({
        success: true,
        message: "Password reset successful"
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: "Failed to reset password",
        error: error.message
      });
    }
  });

  // ==================== PROTECTED API (Auth Required) ====================

  /**
   * @route   GET /api/flutter/v1/profile
   * @desc    Get user profile
   * @access  Private
   */
  flutterRouter.get("/v1/profile", authMiddleware, async (req: any, res: Response) => {
    try {
      const user = await db.getUser(req.user.id);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }
      
      const { password: _, ...userWithoutPassword } = user;
      
      return res.json({
        success: true,
        data: {
          id: userWithoutPassword.id,
          name: userWithoutPassword.fullName,
          email: userWithoutPassword.email,
          username: userWithoutPassword.username,
          role: userWithoutPassword.role,
          is_active: userWithoutPassword.isActive,
          created_at: userWithoutPassword.createdAt,
        },
        message: "Profile retrieved successfully"
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: "Failed to retrieve profile",
        error: error.message
      });
    }
  });

  /**
   * @route   PUT /api/flutter/v1/profile
   * @desc    Update user profile
   * @access  Private
   */
  flutterRouter.put("/v1/profile", authMiddleware, async (req: any, res: Response) => {
    try {
      const { name, email, username } = req.body;
      
      const updateData: any = {};
      if (name) updateData.fullName = name;
      if (email) updateData.email = email;
      if (username) updateData.username = username;
      
      const updatedUser = await db.updateUser(req.user.id, updateData);
      
      const { password: _, ...userWithoutPassword } = updatedUser;
      
      return res.json({
        success: true,
        data: {
          id: userWithoutPassword.id,
          name: userWithoutPassword.fullName,
          email: userWithoutPassword.email,
          username: userWithoutPassword.username,
        },
        message: "Profile updated successfully"
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: "Failed to update profile",
        error: error.message
      });
    }
  });

  /**
   * @route   POST /api/flutter/v1/documents/:id/request
   * @desc    Request document access (for download)
   * @access  Private
   */
  flutterRouter.post("/v1/documents/:id/request", authMiddleware, async (req: any, res: Response) => {
    try {
      const { id } = req.params;
      const { purpose } = req.body;
      
      const document = await db.getDocument(id);
      if (!document) {
        return res.status(404).json({
          success: false,
          message: "Document not found"
        });
      }
      
      // Here you would create a document access request
      // This could be stored in a separate table
      
      // For now, just return the document URL if available
      return res.json({
        success: true,
        data: {
          document_id: document.id,
          title: document.title,
          file_url: document.fileUrl,
          access_granted: true,
          message: "Access granted",
        },
        message: "Document access request processed"
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: "Failed to request document access",
        error: error.message
      });
    }
  });

  /**
   * @route   GET /api/flutter/v1/my-requests
   * @desc    Get user's document access requests
   * @access  Private
   */
  flutterRouter.get("/v1/my-requests", authMiddleware, async (req: any, res: Response) => {
    try {
      // Here you would fetch user's document requests
      // This would come from a document_requests table
      
      // For now, return empty array
      return res.json({
        success: true,
        data: [],
        message: "Requests retrieved successfully"
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: "Failed to retrieve requests",
        error: error.message
      });
    }
  });

  /**
   * @route   POST /api/flutter/v1/change-password
   * @desc    Change user password
   * @access  Private
   */
  flutterRouter.post("/v1/change-password", authMiddleware, async (req: any, res: Response) => {
    try {
      const { current_password, new_password } = req.body;
      
      if (!current_password || !new_password) {
        return res.status(400).json({
          success: false,
          message: "Current password and new password are required"
        });
      }
      
      const user = await db.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }
      
      const { verifyPassword, hashPassword } = await import("../auth");
      
      if (!verifyPassword(current_password, user.password)) {
        return res.status(401).json({
          success: false,
          message: "Current password is incorrect"
        });
      }
      
      const hashedNewPassword = hashPassword(new_password);
      await db.updateUser(req.user.id, { password: hashedNewPassword });
      
      return res.json({
        success: true,
        message: "Password changed successfully"
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: "Failed to change password",
        error: error.message
      });
    }
  });

  /**
   * @route   POST /api/flutter/v1/logout
   * @desc    Logout user
   * @access  Private
   */
  flutterRouter.post("/v1/logout", authMiddleware, async (req: any, res: Response) => {
    try {
      // Client should remove token
      return res.json({
        success: true,
        message: "Logout successful"
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: "Logout failed",
        error: error.message
      });
    }
  });

  // Mount the router
  app.use("/api", flutterRouter);
}