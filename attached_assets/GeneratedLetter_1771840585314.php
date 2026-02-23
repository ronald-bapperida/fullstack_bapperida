<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GeneratedLetter extends Model
{
    protected $fillable = [
        'research_permit_request_id',
        'letter_template_id',
        'file_path',
        'file_name',
        'file_size',
        'letter_number',
        'letter_date',
        'data_snapshot',
        'generated_by',
        'generated_at',
        'sent_at',
        'sent_to_email',
        'send_error',
    ];

    protected $casts = [
        'letter_date' => 'date',
        'generated_at' => 'datetime',
        'sent_at' => 'datetime',
        'data_snapshot' => 'array',
    ];

    public function request(): BelongsTo
    {
        return $this->belongsTo(ResearchPermitRequest::class, 'research_permit_request_id');
    }

    public function template(): BelongsTo
    {
        return $this->belongsTo(LetterTemplate::class, 'letter_template_id');
    }

    public function generator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'generated_by');
    }

    public function getFileUrlAttribute(): string
    {
        return \Storage::disk('public')->url($this->file_path);
    }
}