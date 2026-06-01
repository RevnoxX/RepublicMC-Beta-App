const { MongoClient } = require("mongodb");

exports.handler = async event => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  // Pulling directly from your Netlify Environment Variables
  const uri = process.env.MONGO_URI;
  
  if (!uri) {
    console.error("CRITICAL ERROR: MONGO_URI is missing from Netlify environment variables.");
    return { statusCode: 500, body: JSON.stringify({ error: "Database configuration missing" }) };
  }

  const client = new MongoClient(uri);
  
  try {
    const body = JSON.parse(event.body);
    if (!body.data || Object.keys(body.data).length === 0) {
      return { statusCode: 400, body: "No form data" };
    }

    await client.connect();
    const col = client.db("form_responses").collection("submissions");
    
    // Catching the exact fields from your Google Form data
    const realDiscordId = body.data["Discord ID"] || body["Discord Id"] || "";
    const realSubmittedBy = body.data["Discord Global Name"] || body.data["Discord Username"] || body.submitted_by || "Unknown";

    const toInsert = {
      ...body.data,
      submitted_by: realSubmittedBy,
      submitted_at: body.submitted_at || new Date().toISOString(),
      "Discord Id": realDiscordId, 
      timestamp: new Date(),
      status: "Not Seen"
    };
    
    await col.insertOne(toInsert);

    // Send the DM Notification (Isolated so it doesn't crash the database save)
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
                    content: "🎉 **Application Received!** Your Republic MC Beta Application has been successfully saved. Use `!myform` in the server to check your status!" 
                })
              });
            }
        }
      } catch (dmErr) {
        console.log("DM sending failed silently, but DB save was successful.", dmErr.message);
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
