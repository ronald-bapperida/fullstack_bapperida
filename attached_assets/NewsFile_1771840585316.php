<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class NewsFile extends Model
{
    use HasFactory;

    protected $fillable = [
        'news_id',
        'file_path',
        'file_name',
        'file_type',
        'file_size',
        'type',
        'is_main',
        'caption'
    ];

    protected $casts = [
        'is_main' => 'boolean'
    ];

    public function news()
    {
        return $this->belongsTo(News::class);
    }
}