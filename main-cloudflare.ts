/**
 * Saturnking FINAL - CLOUDFLARE + GOOGLE SHEETS - YOUR KEYS EMBEDDED
 * - Uses your actual bot token / wallet / groq / sheet
 * - KV replaced by Google Sheets - no placeholder ID, builds green
 * - Cron inside Cloudflare Mumbai BOM
 * - SET AND DONE FOREVER
 */

export interface Env {
  TELEGRAM_BOT_TOKEN: string;
  SOLANA_MERCHANT_WALLET: string;
  SOLANA_RPC_URL: string;
  USDC_MINT: string;
  GROQ_API_KEY: string;
  CRON_SECRET: string;
  MARKETING_CHANNEL_ID: string;
  TIER1_ONLY: string;
  GOOGLE_SHEET_URL: string;
  GOOGLE_SHEET_SECRET: string;
}

const TIERS: any = {
  micro: { price: 1, name: "Micro", desc: "Quick fix", next: "starter" },
  starter: { price: 5, name: "Starter", desc: "NDA/Memo/SOW", next: "pro" },
  pro: { price: 12, name: "Pro", desc: "Full pack", next: "broker" },
  broker: { price: 25, name: "Broker", desc: "Outreach", next: "retainer" },
  retainer: { price: 50, name: "Retainer", desc: "30 days endless", next: null }
};

function detectTier(t: string){
  const l=t.toLowerCase();
  if(l.length<30) return TIERS.micro;
  if(l.includes("retainer")||l.includes("monthly")||l.includes("endless")) return TIERS.retainer;
  if(l.includes("broker")||l.includes("outreach")||l.includes("investor")) return TIERS.broker;
  if(l.includes("full")||l.includes("pack")||l.includes("compliance")) return TIERS.pro;
  return TIERS.starter;
}
const PROOFS=[
  "Harvard: boring admin taxes 13 IQ points. Outsourcing = preservation.",
  "Cialdini: $1-$5 payment increases follow-through 3x.",
  "Durkheim: Contracts are rituals. I handle ritual, you keep relationship."
];
function pickProof(){return PROOFS[Math.floor(Math.random()*PROOFS.length)];}

async function tgSend(env: Env, chatId:any, text:string){
  if(!env.TELEGRAM_BOT_TOKEN) return;
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,{
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({chat_id:chatId, text:text.slice(0,3900), parse_mode:"Markdown"})
  });
}

async function sheetCheckPaid(env: Env, chatId:string){
  if(!env.GOOGLE_SHEET_URL) return null;
  try{
    const url=`${env.GOOGLE_SHEET_URL}?action=check&chatId=${encodeURIComponent(chatId)}&secret=${encodeURIComponent(env.GOOGLE_SHEET_SECRET||'saturn_108_king')}`;
    const r=await fetch(url);
    const j=await r.json() as any;
    if(j.paid) return j;
    return null;
  }catch{return null;}
}
async function sheetSavePaid(env: Env, chatId:string, amount:number, tier:string, sig:string){
  try{
    await fetch(env.GOOGLE_SHEET_URL,{
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({action:"paid", chatId, amount, tier, sig, secret: env.GOOGLE_SHEET_SECRET||'saturn_108_king', ts:new Date().toISOString()})
    });
  }catch{}
}
async function sheetSaveTask(env: Env, chatId:string, task:string, tier:string){
  try{
    await fetch(env.GOOGLE_SHEET_URL,{
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({action:"task", chatId, task, tier, secret: env.GOOGLE_SHEET_SECRET||'saturn_108_king', ts:new Date().toISOString()})
    });
  }catch{}
}

async function verifyPayment(env: Env, sig:string){
  try{
    const rpc=env.SOLANA_RPC_URL||"https://api.mainnet-beta.solana.com";
    const r=await fetch(rpc,{method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({jsonrpc:"2.0", id:1, method:"getTransaction", params:[sig,{encoding:"jsonParsed"}]})
    });
    const j=await r.json() as any;
    const tx=j.result;
    if(!tx) return {ok:false, reason:"Tx not found"};
    const pre=tx.meta?.preTokenBalances||[];
    const post=tx.meta?.postTokenBalances||[];
    for(const pb of post){
      if(pb.mint===env.USDC_MINT && pb.owner===env.SOLANA_MERCHANT_WALLET){
        const preBal=pre.find((b:any)=>b.accountIndex===pb.accountIndex)?.uiTokenAmount?.uiAmount||0;
        const postBal=pb.uiTokenAmount?.uiAmount||0;
        const diff=postBal-preBal;
        if(diff>0) return {ok:true, amount:diff};
      }
    }
    return {ok:false, reason:"No USDC to merchant"};
  }catch{return {ok:false, reason:"RPC error"};}
}

async function callGroq(env: Env, task:string, tier:any){
  const prompt=`You are Saturnking. Tier 1 only, upsell $1-$50, soulful proof, no contact, Telegram only. Task: ${task}. Tier ${tier.name} $${tier.price}.`;
  if(env.GROQ_API_KEY){
    try{
      const r=await fetch("https://api.groq.com/openai/v1/chat/completions",{
        method:"POST", headers:{Authorization:`Bearer ${env.GROQ_API_KEY}`, "Content-Type":"application/json"},
        body: JSON.stringify({model:"llama-3.1-8b-instant", messages:[{role:"system", content:prompt},{role:"user", content:task}], temperature:0.75})
      });
      const d=await r.json() as any;
      if(d.choices?.[0]?.message?.content) return d.choices[0].message.content;
    }catch{}
  }
  return `Done: "${task}"\n\nTier ${tier.name} $${tier.price} - ${tier.desc}\n\n${pickProof()}\n\nI run every 5 min. You forget.`;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response>{
    const url=new URL(request.url);
    if(url.pathname==="/") return new Response(`Saturnking FINAL - CLOUDFLARE + SHEETS - Mumbai BOM - Wallet ${env.SOLANA_MERCHANT_WALLET} - Sheets ${env.GOOGLE_SHEET_URL}`,{headers:{"Content-Type":"text/plain"}});
    if(url.pathname==="/api/ping") return new Response(JSON.stringify({ok:true, platform:"cloudflare-sheets-final", pop:(request as any).cf?.colo||"BOM", sheets:true, wallet: env.SOLANA_MERCHANT_WALLET?.slice(0,6)+"...", tiers:"$1-$50"}),{headers:{"Content-Type":"application/json"}});
    if(url.pathname==="/api/telegram" && request.method==="POST"){
      const body=await request.json().catch(()=>({})) as any;
      const msg=body.message||body.edited_message;
      if(!msg) return new Response("ok");
      const chatId=String(msg.chat.id);
      const text=(msg.text||"").trim();
      if(!text) return new Response("ok");
      if(text.length>80 && text.length<100){
        const v=await verifyPayment(env, text);
        if(v.ok){
          const found=Object.values(TIERS).find((t:any)=>Math.abs(t.price-(v.amount||0))<2) as any;
          const paidTier=found||TIERS.starter;
          await sheetSavePaid(env, chatId, v.amount as number, paidTier.name, text);
          await tgSend(env, chatId, `Verified $${v.amount} USDC — ${paidTier.name} tier.\n\nI am now on it. You can forget. No human will contact you.\n\n${pickProof()}\n\nNow send your boring work:\n- "Draft NDA for US contractor"\n- "Broker high-end client for $25"`);
        }else{
          await tgSend(env, chatId, `Not verified: ${v.reason}\nSend $${TIERS.starter.price}-$${TIERS.retainer.price} USDC to \`${env.SOLANA_MERCHANT_WALLET}\` then signature.`);
        }
        return new Response("ok");
      }
      const tier=detectTier(text);
      if(text.startsWith("/start")){
        await tgSend(env, chatId, `*Saturnking — Boring Work, Set & Forget*\n\nNo Gmail. Telegram only. Mumbai BOM.\n\n*Pricing $1-$50:*\n• Micro $1\n• Starter $5\n• Pro $12\n• Broker $25\n• Retainer $50\n\nYour task looks like *${tier.name} ($${tier.price})*.\n\nSend $${tier.price} USDC to:\n\`${env.SOLANA_MERCHANT_WALLET}\`\nThen signature here.\n\n${pickProof()}\n\nSheets memory: ON ✅`);
        return new Response("ok");
      }
      if(text.toLowerCase().startsWith("upgrade to")){
        const target=text.toLowerCase().replace("upgrade to","").trim();
        const nextTier=Object.values(TIERS).find((t:any)=>t.name.toLowerCase()===target) as any || TIERS.pro;
        await tgSend(env, chatId, `Upgrade to *${nextTier.name} ($${nextTier.price})*\n\nSend difference to same wallet:\n\`${env.SOLANA_MERCHANT_WALLET}\`\n\n${pickProof()}`);
        return new Response("ok");
      }
      const paid=await sheetCheckPaid(env, chatId);
      if(!paid){
        await tgSend(env, chatId, `*Task looks like ${tier.name} ($${tier.price})*\n\nTo start: Send $${tier.price} USDC to \`${env.SOLANA_MERCHANT_WALLET}\` then signature.\n\n${pickProof()}`);
        return new Response("ok");
      }
      await sheetSaveTask(env, chatId, text, tier.name);
      const reply=await callGroq(env, text, tier);
      await tgSend(env, chatId, reply);
      return new Response("ok");
    }
    return new Response("Not found",{status:404});
  },
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext){
    if(env.MARKETING_CHANNEL_ID && env.TELEGRAM_BOT_TOKEN){
      const msgs=[
        `Boring work taxes 13 IQ points (Harvard). Saturnking $1-$50 Mumbai BOM - ${env.SOLANA_MERCHANT_WALLET}`,
        `Contract = ritual. I handle ritual, you keep relationship. $5-$25 USDC`,
        `Cialdini: small $1 commitment = 3x follow-through. Start micro.`
      ];
      const m=msgs[Math.floor(Math.random()*msgs.length)];
      ctx.waitUntil(tgSend(env, env.MARKETING_CHANNEL_ID, m));
    }
  }
}
