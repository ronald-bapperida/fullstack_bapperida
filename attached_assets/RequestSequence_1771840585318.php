<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RequestSequence extends Model
{
    protected $fillable = ['key', 'year', 'last_number'];
}