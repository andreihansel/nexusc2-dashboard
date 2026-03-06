const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function checkBots() {
    console.log("Checking for active bots...");
    const { data, error } = await supabase.from('bots').select('*');
    if (error) {
        console.error("Error:", error);
    } else {
        console.log(`Found ${data.length} bots:`);
        data.forEach(b => console.log(`- Bot ID: ${b.bot_id} | Status: ${b.status} | IP: ${b.ip_address} | Last Seen: ${b.last_seen_at}`));
    }
}
checkBots();
