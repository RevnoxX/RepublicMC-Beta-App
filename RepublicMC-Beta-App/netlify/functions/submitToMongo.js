const { MongoClient } = require("mongodb");

exports.handler = async event => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const uri = "mongodb+srv://maya:passmayaapplication@application.z3dfcq.mongodb.net/?retryWrites=true&w=majority&appName=application";
  const client = new MongoClient(uri);
  try {
    const body = JSON.parse(event.body);
    if (!body.data || Object.keys(body.data).length === 0) {
      return { statusCode: 400, body: "No form data" };
    }

    await client.connect();
    const col = client.db("form_responses").collection("submissions");
    const toInsert = {
      ...body.data,
      submitted_by: body.submitted_by,
      submitted_at: body.submitted_at,
      timestamp: new Date()
    };
    await col.insertOne(toInsert);

    return {
      statusCode: 200,
      body: JSON.stringify({ inserted: true })
    };
  } catch (err) {
    console.error("Mongo error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  } finally {
    await client.close();
  }
};
