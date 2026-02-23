<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class PpidDocument extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'title','doc_no',
        'ppid_document_category_id',
        'ppid_document_type_id',
        'ppid_document_kind_id',
        'publisher','published_at',
        'content',
        'file_path','file_url',
        'status',
        'created_by','updated_by',
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

    public function category()
    {
        return $this->belongsTo(PpidDocumentCategory::class, 'ppid_document_category_id');
    }

    public function type()
    {
        return $this->belongsTo(PpidDocumentType::class, 'ppid_document_type_id');
    }

    public function kind()
    {
        return $this->belongsTo(PpidDocumentKind::class, 'ppid_document_kind_id');
    }
}
