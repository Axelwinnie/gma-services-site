const S="GMA Demo Lab. Sample data only, made up for the demo. Granite Models Automations, granitemodels@gmail.com";function G(o,s){const l=document.createElement("a");l.href=URL.createObjectURL(o),l.download=s,document.body.appendChild(l),l.click(),setTimeout(()=>{URL.revokeObjectURL(l.href),l.remove()},800)}const F=o=>{const s=o==null?"":String(o);return/[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s},W=o=>new Blob([o.map(s=>s.map(F).join(",")).join(`\r
`)+`\r
`],{type:"text/csv"}),P=o=>new Blob([JSON.stringify(o,null,2)],{type:"application/json"}),v=o=>window.GMAXlsx.build(o);function A(o,s){const h=[];let d=[],n=744;const m=e=>e.replace(/[\\()]/g,t=>"\\"+t).replace(/[^\x20-\x7e]/g,"?"),M=()=>{h.push(d.join(`
`)),d=[],n=744},f=(e,t,c=9,a=!1)=>d.push(`BT /${a?"F2":"F1"} ${c} Tf ${t} ${n} Td (${m(e)}) Tj ET`),g=e=>{n-e<48&&M()},b=(e,t,c)=>{const a=Math.floor(t/(c*.5));return e.length>a?e.slice(0,a-1)+".":e};g(40),f(o,48,16,!0),n-=16,f(S,48,7.5),n-=10,d.push(`0.976 0.451 0.086 RG 1.5 w 48 ${n} m 564 ${n} l S 0 0 0 RG`),n-=18;for(const e of s){e.heading&&(g(28),f(e.heading,48,11,!0),n-=15);for(const t of e.lines||[])g(14),f(b(t,612-2*48,9),48,9),n-=12;if(e.table&&e.table.length){const t=e.table[0].length,c=(612-2*48)/t;e.table.forEach((a,$)=>{g(13),a.forEach((y,E)=>f(b(y==null?"":String(y),c-4,7.5),48+E*c,7.5,$===0)),n-=11,$===0&&d.push(`0.6 G 0.5 w 48 ${n+7} m 564 ${n+7} l S 0 G`)})}n-=10}M();const i=[],r=e=>(i.push(e),i.length);r("<< /Type /Catalog /Pages 2 0 R >>"),r("PAGES");const j=r("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"),R=r("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"),u=[];h.forEach((e,t)=>{const c=`BT /F1 7 Tf 48 24 Td (${m(`Page ${t+1} of ${h.length}. Sample data only.`)}) Tj ET`,a=e+`
`+c,$=r(`<< /Length ${a.length} >>
stream
${a}
endstream`);u.push(r(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${j} 0 R /F2 ${R} 0 R >> >> /Contents ${$} 0 R >>`))}),i[1]=`<< /Type /Pages /Kids [${u.map(e=>e+" 0 R").join(" ")}] /Count ${u.length} >>`;let p=`%PDF-1.4
`;const T=[];i.forEach((e,t)=>{T.push(p.length),p+=`${t+1} 0 obj
${e}
endobj
`});const x=p.length;return p+=`xref
0 ${i.length+1}
0000000000 65535 f 
`+T.map(e=>String(e).padStart(10,"0")+` 00000 n 
`).join(""),p+=`trailer
<< /Size ${i.length+1} /Root 1 0 R >>
startxref
${x}
%%EOF`,new Blob([p],{type:"application/pdf"})}export{S as N,W as c,P as j,A as p,G as s,v as x};
