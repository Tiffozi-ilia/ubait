// Small dependency-free OOXML writer. All formulas are evaluated by compensation.js;
// user text is stored as inline strings, never executable Excel formulas.
import C from './compensation.js';
import {deflateRawSync} from 'node:zlib';
const xml=v=>String(v??'').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const col=n=>{let s='';for(n++;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
const crcTable=Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=(n&1)?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
const crc32=buf=>{let n=0xffffffff;for(const b of buf)n=crcTable[(n^b)&255]^(n>>>8);return (n^0xffffffff)>>>0;};
function zip(files){
 const data=[],directory=[];let offset=0;
 for(const [path,text]of Object.entries(files)){
  const name=Buffer.from(path),raw=Buffer.from(text),packed=deflateRawSync(raw),crc=crc32(raw),head=Buffer.alloc(30),central=Buffer.alloc(46);
  head.writeUInt32LE(0x04034b50);head.writeUInt16LE(20,4);head.writeUInt16LE(8,8);head.writeUInt16LE(0x5821,12);head.writeUInt32LE(crc,14);head.writeUInt32LE(packed.length,18);head.writeUInt32LE(raw.length,22);head.writeUInt16LE(name.length,26);
  central.writeUInt32LE(0x02014b50);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(8,10);central.writeUInt16LE(0x5821,14);central.writeUInt32LE(crc,16);central.writeUInt32LE(packed.length,20);central.writeUInt32LE(raw.length,24);central.writeUInt16LE(name.length,28);central.writeUInt32LE(offset,42);
  data.push(head,name,packed);directory.push(central,name);offset+=head.length+name.length+packed.length;
 }
 const end=Buffer.alloc(22),dirs=Buffer.concat(directory);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(Object.keys(files).length,8);end.writeUInt16LE(Object.keys(files).length,10);end.writeUInt32LE(dirs.length,12);end.writeUInt32LE(offset,16);
 return Buffer.concat([...data,dirs,end]);
}
function sheet(headers,rows,widths,moneyColumns=[],totalRow=-1){
 const data=[headers,...rows].map((row,ri)=>'<row r="'+(ri+1)+'"'+(ri===0?' ht="32" customHeight="1"':'')+'>'+row.map((v,ci)=>{
  const style=ri===0?1:ri===totalRow?4:moneyColumns.includes(ci)?2:3,at=col(ci)+(ri+1);
  return typeof v==='number'&&Number.isFinite(v)?`<c r="${at}" s="${style}" t="n"><v>${v}</v></c>`:`<c r="${at}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`;
 }).join('')+'</row>').join('');
 return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${col(headers.length-1)}${rows.length+1}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="24"/><cols>${widths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${data}</sheetData><autoFilter ref="A1:${col(headers.length-1)}${Math.max(1,totalRow>0?totalRow:rows.length+1)}"/><pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/></worksheet>`;
}
const styles=`<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00"/></numFmts><fonts count="2"><font><sz val="11"/><color rgb="FF26323B"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF7060A8"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="164" fontId="1" fillId="2" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
export function indexationXlsx({analysis,source,saved,generated_at,hr_generated_at}){
 const labels={employee:'БА',boss:'Руководитель'};
 const rows=analysis.ready.map(({card:c,value:v})=>[c.unit.staff,c.unit.task_id,c.unit.team,c.unit.position,labels[v.track],v.score,v.grade,C.number(c.unit.cost),v.fair_cost,v.indexation,v.cost_after,'https://pyrus.sovcombank.ru/t#id'+c.unit.task_id]);
 const total=analysis.summary.indexation;if(total===null)throw new Error('Сумма индексации слишком велика.');
 rows.push(['Итого','','','','','','','','',total,'','']);
 const excluded=analysis.excluded.map(({card:c,value:v})=>[c.unit.staff,c.unit.task_id,c.unit.team,v.reason||v.indexation_status,`${v.assessed} / ${v.count}`]);
 const model=[['Дата формирования',generated_at],['Срез HR',hr_generated_at],['Версия модели',saved.revision],['Версия формулы',saved.formula_version],['Источник базы БА','Эталон Юнлинг · #'+source.base_task_id],['База БА',source.base],['Коэффициент базы руководителя',saved.model.management_base_multiplier],['База руководителя',source.base===null?null:source.base*saved.model.management_base_multiplier],['Округление','До 2 знаков; сначала стоимость, затем индексация; половина копейки вверх'],['Область','Все доступные руководителю сотрудники со статусом «Работает»'],['Сотрудников',analysis.summary.employees],['Рассчитано',analysis.summary.calculated],['С положительной индексацией',analysis.summary.positive],['Итого индексация',total],['Не рассчитано',analysis.summary.excluded]];
 for(const kind of ['employee','boss']){
  source.tracks[kind].bands.forEach(b=>model.push([labels[kind]+' · порог '+b.grade,b.score]));
  saved.model.growth[kind].forEach((k,i)=>model.push([labels[kind]+' · '+['Юнлинг → Падаван','Падаван → Джедай','Джедай → Магистр'][i],k]));
 }
 const titles=['Индексация','Не рассчитано','Модель'];
 const sheets=[sheet(['ФИО','ID HR-карточки','Подразделение','Должность','Трек','AS IS','Грейд','Текущий оклад','Справедливая стоимость','Индексация','Оклад после индексации','Pyrus'],rows,[36,18,22,25,19,12,24,20,23,20,25,50],[7,8,9,10],rows.length),sheet(['ФИО','ID HR-карточки','Подразделение','Причина','Оценено'],excluded,[36,18,22,65,15]),sheet(['Параметр','Значение'],model,[52,85])];
 const files={
 '[Content_Types].xml':`<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${titles.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`,
 '_rels/.rels':'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
 'xl/workbook.xml':`<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${titles.map((t,i)=>`<sheet name="${t}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`,
 'xl/_rels/workbook.xml.rels':`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${titles.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="styles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
 'xl/styles.xml':styles};
 sheets.forEach((s,i)=>files[`xl/worksheets/sheet${i+1}.xml`]=s);return zip(files);
}
