<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class Page extends Model
{
    protected $fillable = [
        'title','slug','type','status',
        'summary','content','cover_image_path',
        'meta_title','meta_description','meta_keywords',
        'published_at','created_by','updated_by',
    ];

    protected $casts = [
        'published_at' => 'datetime',
    ];

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function updater()
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public function getCoverImageUrlAttribute(): ?string
    {
        if (!$this->cover_image_path) return null;
        return asset('storage/' . ltrim($this->cover_image_path, '/'));
    }
}
