<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Storage;

class Banner extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'title','slug','placement',
        'image_path','mobile_image_path','alt_text',
        'link_type','link_url','page_id','news_id','target',
        'sort_order','is_active','start_at','end_at',
        'view_count','click_count','created_by','updated_by',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'start_at' => 'datetime',
        'end_at' => 'datetime',
    ];

    public function getImageUrlAttribute(): ?string
    {
        if (!$this->image_path) return null;
        return url(Storage::disk('public')->url($this->image_path));
    }

    public function getMobileImageUrlAttribute(): ?string
    {
        if (!$this->mobile_image_path) return null;
        return url(Storage::disk('public')->url($this->mobile_image_path));
    }

    public function scopeActiveNow($q)
    {
        $now = now();
        return $q->where('is_active', true)
            ->where(function($x) use ($now){
                $x->whereNull('start_at')->orWhere('start_at','<=',$now);
            })
            ->where(function($x) use ($now){
                $x->whereNull('end_at')->orWhere('end_at','>=',$now);
            });
    }
}
