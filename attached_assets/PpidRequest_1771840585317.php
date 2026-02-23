<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PpidRequest extends Model
{
    protected $fillable = [
        'request_number','user_id',
        'applicant_name','applicant_email','applicant_phone',
        'information_needed','purpose',
        'status','admin_note','result_note',
        'submitted_at','completed_at','handled_by',
    ];

    protected $casts = [
        'submitted_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function handler()
    {
        return $this->belongsTo(User::class, 'handled_by');
    }

    public function messages()
    {
        return $this->hasMany(PpidRequestMessage::class)->orderBy('created_at');
    }
}
