const { MongoClient } = require("mongodb");

exports.handler = async event => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const uri = "mongodb+srv://mukund260406_db_user:BX8D83Csuj1pWdD6@cluster0.dyfrdfj.mongodb.net/?appName=Cluster0";
  const client = new MongoClient(uri);
  
  try {
    const body = JSON.parse(event.body);
    if (!body.data || Object.keys(body.data).length === 0) {
      return { statusCode: 400, body: "No form data" };
    }

    await client.connect();
    const col = client.db("form_responses").collection("submissions");
    
    // FIX: Grabbing the Discord ID properly so it's no longer "Unknown"
    const toInsert = {
      ...body.data,
      submitted_by: body.["Discord Username"],
      submitted_at: body.submitted_at,
      "Discord Id": body["Discord Id"], 
      timestamp: new Date(),
      status: "Not Seen"
    };
    await col.insertOne(toInsert);

    // NEW: Send a DM Notification to the user via Discord API
    if (process.env.DISCORD_TOKEN && body["Discord Id"]) {
      try {
        // 1. Open a DM channel with the user
        const dmRes = await fetch('https://discord.com/api/v10/users/@me/channels', {
          method: 'POST',
          headers: {
            'Authorization': `Bot ${process.env.DISCORD_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ recipient_id: body["Discord Id"] })
        });
        const dmChannel = await dmRes.json();

        // 2. Send the confirmation message
        if (dmChannel.id) {
          await fetch(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
            method: 'POST',
            headers: {
              'Authorization': `Bot ${process.env.DISCORD_TOKEN}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                content: "🎉 **Application Received!** Your Republic MC Beta Application has been successfully saved to our database. Use `!myform` in the server to check your status anytime!" 
            })
          });
        }
      } catch (err) {
        console.error("Failed to send DM", err);
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
