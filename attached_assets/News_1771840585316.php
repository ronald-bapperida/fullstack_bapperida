<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class News extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'title',
        'slug',
        'content',
        'excerpt',
        'category_id',
        'user_id',
        'published_at',
        'status',
        'view_count',
        'meta_title',
        'meta_description',
        'meta_keywords'
    ];

    protected $casts = [
        'published_at' => 'datetime',
        'view_count' => 'integer'
    ];

    public function category()
    {
        return $this->belongsTo(Category::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function files()
    {
        return $this->hasMany(NewsFile::class);
    }

    public function images()
    {
        return $this->files()->where('type', 'image');
    }

    public function documents()
    {
        return $this->files()->where('type', 'document');
    }

    public function getRouteKeyName()
    {
        return 'slug';
    }

    // ambil 1 gambar pertama sebagai thumbnail
    public function thumbnail()
    {
        return $this->hasOne(NewsFile::class)
            ->where('file_type', 'like', 'image/%')
            ->orderByDesc('is_main')
            ->orderBy('id');
    }

    public function getThumbnailUrlAttribute(): ?string
    {
        $file = $this->relationLoaded('thumbnail') ? $this->thumbnail : null;
        if (!$file || !$file->file_path) return null;

        // file_path contoh: "news/xxx.jpg" di disk public
        return asset('storage/' . ltrim($file->file_path, '/'));
    }
}