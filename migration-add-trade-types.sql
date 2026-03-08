-- Migration: Add 'adjust' and 'dividend' trade types
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)

ALTER TABLE trades DROP CONSTRAINT trades_type_check;
ALTER TABLE trades ADD CONSTRAINT trades_type_check CHECK (type IN ('buy', 'sell', 'adjust', 'dividend'));
