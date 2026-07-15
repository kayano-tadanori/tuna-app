// re-declare figures by requiring source not possible (functions not exported); instead pull from data
const fs=require("fs");
const picks=[
  ["rika_mono", q=>q.question.includes("エアコン")],
  ["rika_hikarioto", q=>q.question.includes("焦点")],
  ["rika_daichi", q=>q.question.includes("外側")],
  ["rika_sora", q=>q.question.includes("日食")],
  ["rika_hikarioto", q=>q.question.includes("3秒後")],
  ["rika_chikara", q=>q.question.includes("氷が全部とけた")],
];
let html="<html><head><meta charset=utf8><style>body{background:#1b1b2b;color:#cdd6f4;font-family:sans-serif}div{margin:16px;padding:10px;border:1px solid #333;background:#232338}.sq-figure svg{max-height:130px}</style></head><body>";
for(const [f,pred] of picks){
  const d=JSON.parse(fs.readFileSync("data/"+f+".json"));
  const q=[...d].reverse().find(pred);
  html+="<div><b>"+q.question.slice(0,40)+"…</b><div class=sq-figure>"+q.svg+"</div><small>答: "+q.answer+"</small></div>";
}
html+="</body></html>";
fs.writeFileSync("/tmp/claude-0/-home-user-tuna-app/2a9b43cb-540d-50b1-93b7-ad661a63ca39/scratchpad/preview7.html",html);
console.log("wrote preview7.html");
EOF
node scratch_preview7.js && rm scratch_preview7.js
