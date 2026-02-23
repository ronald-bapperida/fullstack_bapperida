<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ResearchPermitRequest extends Model
{
    protected $fillable = [
        'request_number',
        'name',
        'email',
        'phone',
        'institution',
        'address',
        'research_title',
        'research_description',
        'target_agency',
        'start_date',
        'end_date',
        'suggestion',
        'final_report_file_path',
        'final_report_original_name',
        'final_report_size',
        'status',
        'review_notes',
        'reviewed_by',
        'reviewed_at',
        'approved_by',
        'approved_at',
        'rejected_by',
        'rejected_at',
        'user_id',
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
        'reviewed_at' => 'datetime',
        'approved_at' => 'datetime',
        'rejected_at' => 'datetime',
    ];

    // Relations
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function rejecter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'rejected_by');
    }

    public function letters(): HasMany
    {
        return $this->hasMany(GeneratedLetter::class);
    }

    public function statusHistories(): HasMany
    {
        return $this->hasMany(ResearchPermitStatusHistory::class);
    }

    // Helpers
    public function getFinalReportUrlAttribute(): ?string
    {
        if (!$this->final_report_file_path) return null;
        return \Storage::disk('public')->url($this->final_report_file_path);
    }
}