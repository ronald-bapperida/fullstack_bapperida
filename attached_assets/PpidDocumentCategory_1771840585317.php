<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PpidDocumentCategory extends Model
{
    protected $fillable = ['name','is_active'];

    public function documents()
    {
        return $this->hasMany(PpidDocument::class, 'ppid_document_category_id');
    }
}