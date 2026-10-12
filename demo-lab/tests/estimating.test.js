const E=require('../public/demos/estimating/estimate.js'),S=require('../public/demos/estimating/shapes.js');
global.window={};require('../public/demos/estimating/samples.js');let fail=0;
const ok=(c,m)=>{if(!c){fail++;console.log('FAIL',m)}};
// AISC v16 nominal / tabulated lb/ft checks
const aisc={"W8x31":31,"W12x26":26,"C10x15.3":15.3,"MC12x10.6":10.6,"HSS6x6x1/4":19.02,"HSS6X6X.250":19.02,"HSS8x8x3/8":37.69,"HSS4x4x1/4":12.21,"L4x4x3/8":9.8,"L3x3x1/4":4.9,"L2x2x1/4":3.19,"Pipe1-1/2STD":2.72,"Pipe3STD":7.58,"PL1/2x6":10.21,"PL3/4x12":30.63};
for(const[k,v]of Object.entries(aisc)){const h=S.lookup(k);ok(h&&Math.abs(h.plf-v)<0.01,k+' got '+(h&&h.plf)+' want '+v);console.log(k.padEnd(14),h&&h.plf,'AISC',v)}
ok(S.lookup('HSS7x7x1/4')===null,'unknown HSS must be null');ok(S.lookup('HSS')===null,'bare HSS');
const L={"20'-6\"":20.5,"9'-4 1/2\"":9.375,"7'-8 3/4\"":7+8.75/12,"12'":12,"6\"":0.5,"20.5":20.5,"0'-10\"":10/12};
for(const[k,v]of Object.entries(L)){ok(Math.abs(E.parseLength(k)-v)<1e-9,'len '+k+' '+E.parseLength(k))}
for(const s of window.GMASamples){const p=E.parseList(s.text),c=E.compute(p.rows,{material:1.1,labor:1.6,waste:5});
 ok(p.skipped.length===0,s.id+' skipped '+JSON.stringify(p.skipped));ok(c.totals.flagged===0,s.id+' flagged');
 console.log(s.id,p.rows.length,'lines',c.totals.pieces,'pcs',c.totals.lbs.toFixed(1),'lb',c.totals.tons.toFixed(2),'t $'+c.totals.total.toFixed(2));
 p.rows.forEach(r=>ok(r.flags.length===0,s.id+' '+r.mark+' '+r.flags))}
// hand check: B1 W12x26 6 @ 24' = 3744 lb ; CB1 W8x31 4@20.5 = 2542
let c=E.compute(E.parseList(window.GMASamples[0].text).rows,{material:1,labor:0,waste:0});ok(c.rows[0].lbs_total===3744,'B1 '+c.rows[0].lbs_total);
c=E.compute(E.parseList(window.GMASamples[1].text).rows,{material:1,labor:0,waste:0});ok(c.rows[0].lbs_total===2542,'CB1');
c=E.compute(E.parseList("C1 HSS6x6x1/4 6 @ 14'-0\"\nX9 W99x1 1 1'\nhello").rows,{});ok(c.rows[0].mark==='C1'&&c.rows[0].qty===6,'C1 mark');
const p=E.parseList("C1 HSS6x6x1/4 6 @ 14'-0\"\nX9 HSS7x7x1/4 1 1'\nhello");ok(p.rows[1].plf===null&&p.skipped.length===1,'flag unknown');
console.log(fail?fail+' FAILED':'ALL PASS');process.exit(fail?1:0)
