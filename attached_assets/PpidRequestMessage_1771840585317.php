<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PpidRequestMessage extends Model
{
    protected $fillable = [
        'ppid_request_id','user_id','sender_role','message',
        'file_path','file_name','mime_type','file_size',
    ];

    protected $casts = [
        'file_size' => 'integer',
    ];

    public function request()
    {
        return $this->belongsTo(PpidRequest::class, 'ppid_request_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
