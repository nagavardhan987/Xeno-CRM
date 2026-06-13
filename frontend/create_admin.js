const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE URL or KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createAdmin() {
  console.log("Creating admin user...");
  const { data, error } = await supabase.auth.signUp({
    email: 'admin@xenocrm.com',
    password: 'AdminSecure!2026',
    options: {
      data: {
        full_name: 'Xeno Admin'
      }
    }
  });

  if (error) {
    console.error("Error creating user:", error.message);
  } else {
    console.log("Successfully created admin user:", data.user?.email);
  }
}

createAdmin();
