import { supabaseAdmin } from "../lib/supabaseAdmin";

async function run() {
  const { data, error } = await supabaseAdmin
    .from("video_queue")
    .insert({
      status: "admin_test",
      source: "bossmind",
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error("❌ ADMIN TEST FAILED:", error);
    process.exit(1);
  }

  console.log("✅ ADMIN TEST PASSED:", data);
  process.exit(0);
}

run();
