// PLEASE store your urls/keys in a .env file
require('dotenv').config();

const GS_API_KEY = process.env.SURUS_API_KEY;
const API_URL = `${process.env.SURUS_API_URL}/v1/embeddings`;

fetch(API_URL, {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + GS_API_KEY,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'nomic-ai/nomic-embed-text-v2-moe',
    input: ['Hola mundo', 'Cómo estás?']
  })
})
.then(res => res.json())
.then(data => console.log(data)); 



// Example result
// {
//   id: 'embd-0f6be0cee6414e0283b36b590b0fcdc8',
//   object: 'list',
//   created: 1751302299,
//   model: 'nomic-ai/nomic-embed-text-v2-moe',
//   data: [
    // { index: 0, object: 'embedding', embedding: [Array] },
    // { index: 1, object: 'embedding', embedding: [Array] }
//   ],
//   usage: {
    // prompt_tokens: 10,
    // total_tokens: 10,
    // completion_tokens: 0,
    // prompt_tokens_details: null
//   }
// }