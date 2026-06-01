const { MongoClient } = require("mongodb");

exports.handler = async event => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  const uri = process.env.MONGO_URI;
  if (!uri) return { statusCode: 500, body: JSON.stringify({ error: "Missing DB URI" }) };

  const client = new MongoClient(uri);
  
  try {
    const body = JSON.parse(event.body);
    if (!body.data) return { statusCode: 400, body: "No form data" };

    await client.connect();
    const col = client.db("form_responses").collection("submissions");
    
    // --- THE FUZZY SEARCH FIX ---
    let realDiscordId = "";
    let realSubmittedBy = "";

    // Scan every single question title the Google Form sent us
    for (const [questionTitle, answer] of Object.entries(body.data)) {
        const lowerTitle = questionTitle.toLowerCase();
        
        // If the question contains the words "discord id", grab the answer!
        if (lowerTitle.includes("discord id")) {
            realDiscordId = answer;
        }
        
        // If the question contains "username" or "global name", grab it!
        if (lowerTitle.includes("username") || lowerTitle.includes("global name")) {
            if (!realSubmittedBy) realSubmittedBy = answer;
        }
    }

    // Backup fallbacks
    if (!realDiscordId) realDiscordId = body["Discord Id"] || "";
    if (!realSubmittedBy) realSubmittedBy = body.submitted_by || "Unknown";

    const toInsert = {
      ...body.data,
      submitted_by: realSubmittedBy,
      submitted_at: body.submitted_at || new Date().toISOString(),
      "Discord Id": realDiscordId, 
      timestamp: new Date(),
      status: "Pending...."
    };
    
    await col.insertOne(toInsert);

    // --- DISCORD DM LOGIC ---
    if (process.env.DISCORD_TOKEN && realDiscordId) {
      try {
        const dmRes = await fetch('https://discord.com/api/v10/users/@me/channels', {
          method: 'POST',
          headers: {
            'Authorization': `Bot ${process.env.DISCORD_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ recipient_id: realDiscordId })
        });
        
        if (dmRes.ok) {
            const dmChannel = await dmRes.json();
            if (dmChannel.id) {
              await fetch(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bot ${process.env.DISCORD_TOKEN}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    content: "🎉 **Application Received!** Your Republic MC Beta Application has been successfully saved. Use `!myform` in the server to check your status! For any issue contact Madhav(gameon26) or Panda." 
                })
              });
            }
        }
      } catch (dmErr) {
        console.log("DM failed, but DB save was successful.", dmErr.message);
      }
    }

    return { statusCode: 200, body: JSON.stringify({ inserted: true }) };
  } catch (err) {
    console.error("Mongo error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  } finally {
    await client.close();
  }
};
