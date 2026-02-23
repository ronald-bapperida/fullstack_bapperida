<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PpidDocumentType extends Model
{
    protected $fillable = ['name','extension','is_active'];

    public function documents()
    {
        return $this->hasMany(PpidDocument::class, 'ppid_document_type_id');
    }
}