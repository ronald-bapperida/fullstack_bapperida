import { logger } from "./logger";
import express, { type Request, type Response } from "express";
import { storage as db } from "./storage";
import { authMiddleware, optionalAuthMiddleware } from "./auth";
import multer from "multer";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import { and, eq, isNull, desc, sql } from "drizzle-orm";
import { db as drizzleDb } from "./db";
import * as schema from "@shared/schema";
import { sendPpidInfoRequestConfirmation, sendKeberatanConfirmation } from "./email";

function generateToken(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let token = "";
  for (let i = 0; i < 8; i++) token += chars[Math.floor(Math.random() * chars.length)];
  return token;
}

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
  flutterRouter.post("/v1/banners/:id/click", async (req: Request, res: Response) => {
    try {
      await db.trackBannerClick(req.params.id);
      return res.json({ success: true, message: "Click tracked" });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: "Failed to track click", error: error.message });
    }
  });

  flutterRouter.get("/v1/banners", async (req: Request, res: Response) => {
    try {
      const banners = await db.getActiveBanners();
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
  flutterRouter.get("/v1/news/:id", async (req: Request, res: Response) => {
    try {
      const idParam = req.params.id;
      const id = typeof idParam === "string" ? idParam : idParam?.[0] ?? "";

      logger.log(id);

      const news = await db.getNewsById(id);
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
  // flutterRouter.post("/v1/news/:id/view", async (req: Request, res: Response) => {
  //   try {
  //     const { id } = req.params;
      
  //     const news = await db.getNewsById(id);
  //     if (!news) {
  //       return res.status(404).json({
  //         success: false,
  //         message: "News not found"
  //       });
  //     }
      
  //     await db.updateNews(news.id, { viewCount: (news.viewCount || 0) + 1 });
      
  //     const updatedNews = await db.getNews(news.id);
      
  //     return res.json({
  //       success: true,
  //       data: { view_count: updatedNews?.viewCount || 0 },
  //       message: "View tracked successfully"
  //     });
  //   } catch (error: any) {
  //     return res.status(500).json({
  //       success: false,
  //       message: "Failed to track view",
  //       error: error.message
  //     });
  //   }
  // });

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
          categories: categories.map(c => ({ id: c.id, name: c.name, level: c.level })),
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
        status: "published",
      });
      
      // Get additional info for each document
      const items = await Promise.all(result.items.map(async (item) => {
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
          total: result.total,
          page,
          limit,
          total_pages: Math.ceil(result.total / limit)
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
      const idParam = req.params.id;
      const id = typeof idParam === "string" ? idParam : idParam?.[0] ?? "";

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
        downloaded_count: document.downloadedCount,
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

  flutterRouter.post("/v1/documents/:id/download", async (req: Request, res: Response) => {
    try {
      const idParam = req.params.id;
      const id = typeof idParam === "string" ? idParam : idParam?.[0] ?? "";
      
      const document = await db.getDocumentById(id);
      if (!document) {
        return res.status(404).json({
          success: false,
          message: "Document not found"
        });
      }
      
      // Increment download count
      await db.incrementDocumentDownload(id);
      
      const updatedDoc = await db.getDocumentById(id);
      
      return res.json({
        success: true,
        data: { 
          downloaded_count: updatedDoc?.downloadedCount || 0,
          file_url: document.fileUrl 
        },
        message: "Download tracked successfully"
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: "Failed to track download",
        error: error.message
      });
    }
  });

  flutterRouter.post("/v1/documents-request", async (req: Request, res: Response) => {
    try {
      const { documentId, userId, name, email, phone, purpose } = req.body;
  
      if (!documentId || !name || !email || !phone || !purpose) {
        return res.status(400).json({
          success: false,
          message: "Incomplete request data"
        });
      }
  
      const document = await db.getDocumentById(documentId);
  
      if (!document) {
        return res.status(404).json({
          success: false,
          message: "Document not found"
        });
      }
  
      await db.createDocumentRequest({
        documentId,
        userId,
        name,
        email,
        phone,
        purpose
      });
  
      await db.incrementDocumentDownload(documentId);
  
      const updatedDoc = await db.getDocumentById(documentId);
  
      return res.json({
        success: true,
        data: {
          downloaded_count: updatedDoc?.downloadedCount || 0,
          file_url: document.fileUrl
        },
        message: "Document request recorded"
      });
  
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: "Failed to process document request",
        error: error.message
      });
    }
  });

  /**
   * @route   GET /api/flutter/v1/menus
   * @desc    Get all active menus dengan items-nya
   * @access  Public
   */
  flutterRouter.get("/v1/menus", async (req: Request, res: Response) => {
    try {
      const menus = await db.listMenus();
      const activeMenus = menus.filter((m) => m.isActive);
  
      const result = await Promise.all(
        activeMenus.map(async (menu) => {
          const allItems = await db.listMenuItems(menu.id);
          // Bangun hierarki: root items + children
          const roots = allItems.filter((i) => !i.parentId);
          const buildTree = (parent: typeof allItems[0]) => {
            const children = allItems
              .filter((i) => i.parentId === parent.id)
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((child) => ({
                ...formatMenuItem(child),
                children: buildTree(child),
              }));
            return children;
          };
  
          return {
            id: menu.id,
            name: menu.name,
            location: menu.location,
            is_active: menu.isActive,
            items: roots
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((item) => ({
                ...formatMenuItem(item),
                children: buildTree(item),
              })),
          };
        })
      );
  
      return res.json({ success: true, data: result, message: "Menus retrieved successfully" });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: "Failed to retrieve menus", error: error.message });
    }
  });
  
  /**
   * @route   GET /api/flutter/v1/menus/by-name/:name
   * @desc    Get menu items by menu name (case-insensitive)
   *          Contoh: /menus/by-name/Beranda  atau  /menus/by-name/Profil
   * @access  Public
   */
  flutterRouter.get("/v1/menus/by-name/:name", async (req: Request, res: Response) => {
    try {
      const { name } = req.params;
  
      const menus = await db.listMenus();
      const menu = menus.find(
        (m) => m.name.toLowerCase() === name.toLowerCase() && m.isActive
      );
  
      if (!menu) {
        return res.status(404).json({
          success: false,
          message: `Menu "${name}" tidak ditemukan atau tidak aktif`,
        });
      }
  
      const allItems = await db.listMenuItems(menu.id);
  
      const buildTree = (parentId: string | null): any[] => {
        return allItems
          .filter((i) => (parentId ? i.parentId === parentId : !i.parentId))
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((item) => ({
            ...formatMenuItem(item),
            children: buildTree(item.id),
          }));
      };
  
      return res.json({
        success: true,
        data: {
          id: menu.id,
          name: menu.name,
          location: menu.location,
          is_active: menu.isActive,
          items: buildTree(null),
        },
        message: "Menu items retrieved successfully",
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: "Failed to retrieve menu",
        error: error.message,
      });
    }
  });
  
  /**
   * @route   GET /api/flutter/v1/menus/item/:id
   * @desc    Get single menu item by ID (termasuk value/HTML-nya)
   * @access  Public
   */
  flutterRouter.get("/v1/menus/item/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const item = await db.getMenuItem(id);
  
      if (!item) {
        return res.status(404).json({ success: false, message: "Menu item tidak ditemukan" });
      }
  
      return res.json({
        success: true,
        data: formatMenuItem(item),
        message: "Menu item retrieved successfully",
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: "Failed to retrieve menu item",
        error: error.message,
      });
    }
  });
  
  // ─── Helper ──────────────────────────────────────────────────────────────────
  
  function formatMenuItem(item: any) {
    return {
      id: item.id,
      menu_id: item.menuId,
      parent_id: item.parentId ?? null,
      title: item.title,
      type: item.type,           // "url" | "page" | "html" | "news" | "ppid_documents" | ...
      value: item.value ?? null, // HTML content, URL, route, dsb.
      icon: item.icon ?? null,
      target: item.target ?? "_self",
      requires_auth: item.requiresAuth ?? false,
      sort_order: item.sortOrder ?? 0,
      is_active: true,           // sudah difilter isNull(deletedAt) di listMenuItems
    };
  }

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
      const { verifyPassword, signToken, generateRefreshToken } = await import("./auth");
      
      if (!verifyPassword(password, user.password)) {
        return res.status(401).json({
          success: false,
          message: "Invalid email or password"
        });
      }
      
      const accessToken  = signToken({ id: user.id, username: user.username, role: user.role });
      const refreshToken = generateRefreshToken();
      const expiresAt    = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await db.createRefreshToken(user.id, refreshToken, expiresAt);
      
      const { password: _, ...userWithoutPassword } = user;
      
      return res.json({
        success: true,
        data: {
          token: accessToken,
          access_token: accessToken,
          refresh_token: refreshToken,
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
      const { name, email, password, username, phone } = req.body;
      
      if (!name || !email || !password || !phone) {
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
      const { hashPassword } = await import("./auth");
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
        phone: phone
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
   * @route   POST /api/flutter/v1/auth/refresh
   * @desc    Refresh access token using refresh token
   * @access  Public
   */
  flutterRouter.post("/v1/auth/refresh", async (req: Request, res: Response) => {
    try {
      const { refresh_token } = req.body;
      if (!refresh_token) {
        return res.status(400).json({ success: false, message: "Refresh token is required" });
      }
      const record = await db.getRefreshToken(refresh_token);
      if (!record || record.revoked || new Date(record.expires_at) < new Date()) {
        return res.status(401).json({ success: false, message: "Refresh token invalid or expired" });
      }
      const user = await db.getUser(record.user_id);
      if (!user || !user.isActive) {
        return res.status(401).json({ success: false, message: "Account is inactive" });
      }
      const { signToken } = await import("./auth");
      const accessToken = signToken({ id: user.id, username: user.username, role: user.role });
      return res.json({ success: true, data: { token: accessToken, access_token: accessToken } });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: "Failed to refresh token", error: error.message });
    }
  });

  /**
   * @route   POST /api/flutter/v1/auth/logout
   * @desc    Revoke refresh token
   * @access  Public
   */
  flutterRouter.post("/v1/auth/logout", async (req: Request, res: Response) => {
    try {
      const { refresh_token } = req.body;
      if (refresh_token) await db.revokeRefreshToken(refresh_token).catch(() => {});
      return res.json({ success: true, message: "Logged out successfully" });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: "Failed to logout", error: error.message });
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
        return res.status(400).json({ success: false, message: "Email wajib diisi" });
      }
      const user = await db.getUserByEmail(email);
      if (user) {
        const otp = String(Math.floor(100000 + Math.random() * 900000));
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        await db.deleteOtpForUser(user.id);
        await db.createOtp(user.id, otp, expiresAt);
        const { sendOtpResetEmail } = await import("./email");
        await sendOtpResetEmail(user.email!, otp, user.fullName || user.username).catch(logger.error);
      }
      return res.json({ success: true, message: "Jika email terdaftar, kode OTP telah dikirim" });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: "Gagal memproses permintaan", error: error.message });
    }
  });

  /**
   * @route   POST /api/flutter/v1/auth/verify-otp
   * @desc    Verify OTP and get reset token
   * @access  Public
   */
  flutterRouter.post("/v1/auth/verify-otp", async (req: Request, res: Response) => {
    try {
      const { email, otp } = req.body;
      if (!email || !otp) {
        return res.status(400).json({ success: false, message: "Email dan OTP wajib diisi" });
      }
      const user = await db.getUserByEmail(email);
      if (!user) return res.status(400).json({ success: false, message: "OTP tidak valid atau sudah kedaluwarsa" });
      const record = await db.getOtp(user.id);
      if (!record) return res.status(400).json({ success: false, message: "OTP tidak valid atau sudah kedaluwarsa" });
      if (new Date(record.expiresAt) < new Date()) {
        await db.deleteOtpForUser(user.id);
        return res.status(400).json({ success: false, message: "OTP sudah kedaluwarsa" });
      }
      if (record.otp !== String(otp)) {
        return res.status(400).json({ success: false, message: "OTP salah" });
      }
      await db.markOtpVerified(record.id);
      const jwt = (await import("jsonwebtoken")).default;
      const resetToken = jwt.sign(
        { userId: user.id, purpose: "reset-password" },
        process.env.JWT_SECRET || "secret",
        { expiresIn: "15m" }
      );
      return res.json({ success: true, message: "OTP valid", reset_token: resetToken });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: "Gagal memverifikasi OTP", error: error.message });
    }
  });

  /**
   * @route   POST /api/flutter/v1/auth/reset-password
   * @desc    Reset password with reset token
   * @access  Public
   */
  flutterRouter.post("/v1/auth/reset-password", async (req: Request, res: Response) => {
    try {
      const { reset_token, new_password } = req.body;
      if (!reset_token || !new_password) {
        return res.status(400).json({ success: false, message: "Token dan password baru wajib diisi" });
      }
      const jwt = (await import("jsonwebtoken")).default;
      let payload: any;
      try {
        payload = jwt.verify(reset_token, process.env.JWT_SECRET || "secret");
      } catch {
        return res.status(400).json({ success: false, message: "Token tidak valid atau sudah kedaluwarsa" });
      }
      if (payload.purpose !== "reset-password") {
        return res.status(400).json({ success: false, message: "Token tidak valid" });
      }
      if (new_password.length < 6) {
        return res.status(400).json({ success: false, message: "Password minimal 6 karakter" });
      }
      const { hashPassword } = await import("./auth");
      const hashed = await hashPassword(new_password);
      await db.updateUser(payload.userId, { password: hashed });
      await db.deleteOtpForUser(payload.userId);
      return res.json({ success: true, message: "Password berhasil direset" });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: "Gagal mereset password", error: error.message });
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
          phone: userWithoutPassword.phone,
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
      const { name, email, username, phone } = req.body;
      
      const updateData: any = {};
      if (name) updateData.fullName = name;
      if (email) updateData.email = email;
      if (username) updateData.username = username;
      if (phone) updateData.phone = phone;
      
      const updatedUser = await db.updateUser(req.user.id, updateData);
      
      const { password: _, ...userWithoutPassword } = updatedUser;
      
      return res.json({
        success: true,
        data: {
          id: userWithoutPassword.id,
          name: userWithoutPassword.fullName,
          email: userWithoutPassword.email,
          username: userWithoutPassword.username,
          phone: userWithoutPassword.phone
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
      
      const { verifyPassword, hashPassword } = await import("./auth");
      
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

  // ─── PPID Keberatan (Flutter/Public) ─────────────────────────────────────────
  const ppidObjectionUpload = getMulter("ppid/objections", 5);

  /**
   * @route   POST /api/flutter/ppid/objections
   * @desc    Submit keberatan PPID (public)
   * @access  Public
   */
  flutterRouter.post(
    "/v1/ppid/objections",
    optionalAuthMiddleware,
    ppidObjectionUpload.fields([
      { name: "ktpFile", maxCount: 1 },
      { name: "evidenceFile", maxCount: 1 },
    ]),
    async (req: any, res: Response) => {
      try {
        const files = req.files as Record<string, Express.Multer.File[]>;
        const ktpFile      = files?.ktpFile?.[0];
        const evidenceFile = files?.evidenceFile?.[0];

        const { fullName, nik, address, phone, email, occupation,
                requestCode, informationDetail, requestPurpose,
                objectionReasons, objectionNote } = req.body;

        if (!fullName || !nik || !address || !phone || !informationDetail || !requestPurpose) {
          return res.status(400).json({ success: false, message: "Field wajib tidak lengkap" });
        }

        // Parse objection reasons — bisa berupa string JSON atau array
        let reasons: string[] = [];
        if (objectionReasons) {
          if (typeof objectionReasons === "string") {
            try { reasons = JSON.parse(objectionReasons); } catch { reasons = [objectionReasons]; }
          } else if (Array.isArray(objectionReasons)) {
            reasons = objectionReasons;
          }
        }

        const submitterUserId: string | null = req.user?.id || null;

        const data = {
          userId:           submitterUserId,
          requestCode:      requestCode || null,
          fullName,
          nik,
          address,
          phone,
          email:            email     || null,
          occupation:       occupation || null,
          ktpFileUrl:       ktpFile      ? fileUrl("ppid/objections", ktpFile.filename)      : null,
          informationDetail,
          requestPurpose,
          objectionReasons: reasons,
          objectionNote:    objectionNote || null,
          evidenceFileUrl:  evidenceFile  ? fileUrl("ppid/objections", evidenceFile.filename) : null,
        };

        const result = await db.createPpidObjection(data);
        // FCM push ke admin BPP (non-blocking)
        import("./services/firebase-admin").then(({ sendEventPush }) => {
          sendEventPush({
            title: "Keberatan PPID Baru",
            body: `${fullName} mengajukan keberatan PPID baru.`,
            data: { type: "new_objection", objectionId: result.id },
            targetRoles: ["admin_bpp", "super_admin"],
            tokenGetter: (role) => role ? db.getFcmTokensByRole(role) : Promise.resolve([]),
            tokenRemover: (t) => db.removeInvalidFcmTokens(t),
          });
        }).catch(() => {});
        // Simpan ke inbox notifikasi admin
        db.createNotification({ type: "new_objection", title: "Keberatan PPID Baru", message: `${fullName} mengajukan keberatan PPID baru.`, resourceId: result.id, resourceType: "ppid_objection", targetRole: "admin_bpp" }).catch(() => {});
        // Kirim email konfirmasi ke pemohon (jika ada email)
        if (email) {
          sendKeberatanConfirmation({
            to: email,
            fullName,
            objectionId: result.id,
            requestCode: requestCode || undefined,
          }).catch((err: any) => logger.error("Keberatan email failed:", err));
        }
        return res.status(201).json({ success: true, message: "Keberatan berhasil dikirim", data: result });
      } catch (error: any) {
        return res.status(500).json({ success: false, message: "Gagal mengirim keberatan", error: error.message });
      }
    }
  );

  /**
   * @route   GET /api/flutter/ppid/objections/:id
   * @desc    Get detail keberatan by ID (public – untuk cek status)
   * @access  Public
   */
  flutterRouter.get("/v1/ppid/objections/:id", async (req: Request, res: Response) => {
    try {
      const item = await db.getPpidObjection(req.params.id);
      if (!item) return res.status(404).json({ success: false, message: "Tidak ditemukan" });
      return res.json({ success: true, data: item });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  });

  // ─── PPID Permohonan Informasi (Flutter/Public) ───────────────────────────────
  const ppidInfoReqUpload = getMulter("ppid/info-requests", 5);

  /**
   * @route   POST /api/flutter/ppid/information-requests
   * @desc    Submit permohonan informasi PPID (public)
   * @access  Public
   */
  flutterRouter.post(
    "/v1/ppid/information-requests",
    optionalAuthMiddleware,
    ppidInfoReqUpload.fields([{ name: "ktpFile", maxCount: 1 }]),
    async (req: any, res: Response) => {
      try {
        const files = req.files as Record<string, Express.Multer.File[]>;
        const ktpFile = files?.ktpFile?.[0];

        const { fullName, nik, address, phone, email, occupation,
                informationDetail, requestPurpose, retrievalMethod } = req.body;

        if (!fullName || !nik || !address || !phone || !informationDetail || !requestPurpose) {
          return res.status(400).json({ success: false, message: "Field wajib tidak lengkap" });
        }

        const submitterUserId: string | null = req.user?.id || null;
        const token = generateToken();
        const data = {
          userId:          submitterUserId,
          token,
          fullName,
          nik,
          address,
          phone,
          email:           email          || null,
          occupation:      occupation      || null,
          ktpFileUrl:      ktpFile         ? fileUrl("ppid/info-requests", ktpFile.filename) : null,
          informationDetail,
          requestPurpose,
          retrievalMethod: retrievalMethod || null,
        };

        const result = await db.createPpidInfoRequest(data);
        // FCM push ke admin BPP (non-blocking)
        import("./services/firebase-admin").then(({ sendEventPush }) => {
          sendEventPush({
            title: "Permohonan Informasi PPID Baru",
            body: `${fullName} mengajukan permohonan informasi publik baru.`,
            data: { type: "new_info_request", requestId: result.id },
            targetRoles: ["admin_bpp", "super_admin"],
            tokenGetter: (role) => role ? db.getFcmTokensByRole(role) : Promise.resolve([]),
            tokenRemover: (t) => db.removeInvalidFcmTokens(t),
          });
        }).catch(() => {});
        // Simpan ke inbox notifikasi admin
        db.createNotification({ type: "new_info_request", title: "Permohonan Informasi PPID Baru", message: `${fullName} mengajukan permohonan informasi publik baru.`, resourceId: result.id, resourceType: "ppid_info_request", targetRole: "admin_bpp" }).catch(() => {});
        // Kirim email konfirmasi dengan token jika email tersedia
        if (email) {
          sendPpidInfoRequestConfirmation({
            to: email,
            fullName,
            token,
            informationDetail,
          }).catch((err: any) => logger.error("PPID confirmation email failed:", err));
        }
        return res.status(201).json({ success: true, message: "Permohonan informasi berhasil dikirim", data: result });
      } catch (error: any) {
        return res.status(500).json({ success: false, message: "Gagal mengirim permohonan", error: error.message });
      }
    }
  );

  /**
   * @route   GET /api/v1/ppid/information-requests/by-token/:token
   * @desc    Lookup permohonan informasi by request code/token (for keberatan pre-fill)
   * @note    MUST be registered BEFORE /:id route to avoid conflict
   * @access  Public
   */
  flutterRouter.get("/v1/ppid/information-requests/by-token/:token", async (req: Request, res: Response) => {
    try {
      const item = await db.getPpidInfoRequestByToken(req.params.token);
      if (!item) return res.status(404).json({ success: false, message: "Kode permohonan tidak ditemukan" });
      // Return fields needed for keberatan pre-fill + status tracking
      return res.json({
        success: true,
        data: {
          id:                item.id,
          token:             item.token,
          fullName:          item.fullName,
          nik:               item.nik,
          address:           item.address,
          phone:             item.phone,
          email:             item.email,
          occupation:        item.occupation,
          ktpFileUrl:        item.ktpFileUrl,
          informationDetail: item.informationDetail,
          requestPurpose:    item.requestPurpose,
          retrievalMethod:   item.retrievalMethod,
          status:            item.status,
          reviewNote:        item.reviewNote,
          responseFileUrl:   item.responseFileUrl,
          createdAt:         item.createdAt,
        },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  });

  /**
   * @route   GET /api/flutter/ppid/information-requests/:id
   * @desc    Get detail permohonan informasi by ID (public – untuk cek status)
   * @access  Public
   */
  flutterRouter.get("/v1/ppid/information-requests/:id", async (req: Request, res: Response) => {
    try {
      const item = await db.getPpidInfoRequest(req.params.id);
      if (!item) return res.status(404).json({ success: false, message: "Tidak ditemukan" });
      return res.json({ success: true, data: item });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  });

  // ─── Izin Penelitian: cek status & URL PDF surat ──────────────────────────
  flutterRouter.get("/v1/permits/:id/status", async (req: Request, res: Response) => {
    try {
      const permit = await db.getPermit(req.params.id);
      if (!permit) return res.status(404).json({ success: false, message: "Izin penelitian tidak ditemukan" });

      // Ambil generated letter terbaru untuk permit ini
      const letter = await db.getGeneratedLetter(permit.id);

      const statusLabels: Record<string, string> = {
        submitted: "Permohonan Diterima",
        in_review: "Sedang Direview",
        revision_requested: "Perlu Revisi",
        approved: "Disetujui",
        generated_letter: "Surat Diterbitkan",
        sent: "Surat Terkirim",
        rejected: "Ditolak",
      };

      return res.json({
        success: true,
        data: {
          id: permit.id,
          requestNumber: permit.requestNumber,
          status: permit.status,
          statusLabel: statusLabels[permit.status] || permit.status,
          fullName: permit.fullName,
          institution: permit.institution,
          researchTitle: permit.researchTitle,
          createdAt: permit.createdAt,
          reviewNote: permit.reviewNote,
          // URL surat (PDF diutamakan)
          letterFileUrl: letter?.pdfFileUrl || letter?.fileUrl || null,
          letterPdfUrl: letter?.pdfFileUrl || null,
          letterDocxUrl: letter?.fileUrl || null,
          letterGeneratedAt: letter?.createdAt || null,
        },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  });

  // ─── Daftar izin penelitian user yang login ────────────────────────────────
  flutterRouter.get("/v1/my-permits", authMiddleware, async (req: any, res: Response) => {
    try {
      const userId = req.user.id;
      const { db: drizzle } = await import("./db");
      const schema = await import("../shared/schema");
      const { eq, isNull, desc } = await import("drizzle-orm");

      const permits = await drizzle
        .select()
        .from(schema.researchPermitRequests)
        .where(eq(schema.researchPermitRequests.userId, userId))
        .orderBy(desc(schema.researchPermitRequests.createdAt));

      // Ambil generated letters untuk setiap permit
      const results = await Promise.all(permits.map(async (p) => {
        const letter = await db.getGeneratedLetter(p.id);
        const statusLabels: Record<string, string> = {
          submitted: "Permohonan Diterima", in_review: "Sedang Direview",
          revision_requested: "Perlu Revisi", approved: "Disetujui",
          generated_letter: "Surat Diterbitkan", sent: "Surat Terkirim", rejected: "Ditolak",
        };
        return {
          id: p.id,
          requestNumber: p.requestNumber,
          status: p.status,
          statusLabel: statusLabels[p.status] || p.status,
          fullName: p.fullName,
          institution: p.institution,
          researchTitle: p.researchTitle,
          createdAt: p.createdAt,
          reviewNote: p.reviewNote,
          letterFileUrl: letter?.pdfFileUrl || letter?.fileUrl || null,
          letterPdfUrl: letter?.pdfFileUrl || null,
        };
      }));

      return res.json({ success: true, data: results });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  });

  /**
   * @route   POST /api/v1/fcm/token
   * @desc    Register or update FCM token for mobile push notifications
   * @access  Private
   */
  flutterRouter.post("/v1/fcm/token", authMiddleware, async (req: any, res: Response) => {
    try {
      const { token, device_type = "android" } = req.body;
      if (!token) return res.status(400).json({ success: false, message: "Token wajib diisi" });
      await db.upsertFcmToken(req.user.id, token, device_type, "mobile");
      return res.json({ success: true, message: "FCM token berhasil disimpan" });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: "Gagal menyimpan FCM token", error: error.message });
    }
  });

  /**
   * @route   DELETE /api/v1/fcm/token
   * @desc    Remove FCM token on logout
   * @access  Private
   */
  flutterRouter.delete("/v1/fcm/token", authMiddleware, async (req: any, res: Response) => {
    try {
      await db.removeFcmToken(req.user.id, "mobile");
      return res.json({ success: true, message: "FCM token berhasil dihapus" });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: "Gagal menghapus FCM token", error: error.message });
    }
  });

  /**
   * @route   GET /api/v1/notifications
   * @desc    Stub endpoint — app now uses FCM push for all notifications.
   *          Returns empty list for backward compatibility.
   * @access  Private
   */
  flutterRouter.get("/v1/notifications", authMiddleware, async (req: any, res: Response) => {
    return res.json({
      success: true,
      data: {
        items: [],
        unread_count: 0,
        page: 1,
        limit: 20,
      },
      message: "Notifications are now delivered via FCM push. Register your FCM token at POST /api/v1/fcm/token.",
    });
  });

  /**
   * @route   PATCH /api/v1/notifications/:id/read
   * @desc    Stub — kept for backward compatibility
   */
  flutterRouter.patch("/v1/notifications/:id/read", authMiddleware, async (_req: any, res: Response) => {
    return res.json({ success: true, message: "Notification acknowledged" });
  });

  /**
   * @route   POST /api/v1/notifications/mark-all-read
   * @desc    Stub — kept for backward compatibility
   */
  flutterRouter.post("/v1/notifications/mark-all-read", authMiddleware, async (_req: any, res: Response) => {
    return res.json({ success: true, message: "All notifications acknowledged" });
  });

  // Mount the router
  app.use("/api", flutterRouter);
}