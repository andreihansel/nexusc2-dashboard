const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkLoot() {
    const { data, error } = await supabase.from('loot').select('*').order('created_at', { ascending: false }).limit(5);
    if (error) {
        console.error("DB Error:", error);
    } else {
        console.log("Recent Loot Entries:");
        data.forEach(d => console.log(`- [${d.category}] ${d.title} (Bot: ${d.bot_id})`));
        if (data.length === 0) console.log("No loot found.");
    }
}
checkLoot();
