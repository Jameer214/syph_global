import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  'https://phkkmxlkvflozsyxafsq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBoa2tteGxrdmZsb3pzeXhhZnNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwMTUyOTIsImV4cCI6MjA5NjU5MTI5Mn0.jAEJ5m4LxC-VG5iBdVZrkqSTOM_QQXOzS_MalbsNXTM'
);
