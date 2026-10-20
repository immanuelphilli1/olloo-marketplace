---
name: staff-notification-fanout
description: Staff email and in-app alerts go only to admin-configured recipient emails matched to staff accounts. Use when wiring payment/inquiry/order staff alerts or editing StaffNotificationFanout or its tests.
---

## Goal
Alerts reach configured recipients only, never every staff user.

## Steps
1. Read recipient emails from `NotificationRecipientSettings` (admin-configured; empty means nobody, no env fallback).
2. Send mail to those emails only.
3. In-app rows via `StaffNotificationFanout::notifyStaffEmails($emails, ...)`: case-insensitive match on staff `email`, skip addresses with no staff account.
4. Tests: set recipient emails to the created staff user's email, or assert zero in-app rows when lists are empty.

## What didn't work
- `User::where('user_type', 'staff')->get()` and notifying each: fans out past the configured list.
- Tests using `finance@`/`desk@` recipients while `makeStaff()` creates `admin-notify@`: mail assertions pass while in-app counts are wrong.
