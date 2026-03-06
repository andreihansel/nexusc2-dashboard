const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function testInsert() {
    console.log("Attempting to insert dummy loot using ANON_KEY...");
    const { data, error } = await supabase.from('loot').insert({
        bot_id: "c9f0367d-536b-4956-903c-5c1a5a18c113",
        category: "other",
        title: "Test Loot Insert",
        content: "This is a test from the node script.",
        priority: 1,
        metadata: {}
    }).select();

    if (error) {
        console.error("❌ INSERT ERROR:", error);
    } else {
        console.log("✅ INSERT SUCCESS:", data);
    }
}
testInsert();
