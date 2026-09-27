// src/lib/pdf/generate.tsx
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import type { ResumeData } from '@/types/resume'

// @react-pdf/renderer is a pure-JS PDF renderer (no headless browser, no
// native binary) — chosen specifically because it behaves identically in
// local dev (Windows/Mac/Linux) and in serverless deployment (Vercel/Netlify),
// unlike Puppeteer-based HTML-to-PDF approaches which need a Linux-only
// Chromium binary that doesn't run on a Windows dev machine at all.
//
// This produces one clean, ATS-safe layout (real selectable text, no images,
// single column) rather than pixel-matching each of the four HTML/CSS
// templates — reproducing four arbitrary CSS designs in @react-pdf's layout
// primitives would be a large, fragile undertaking for a format whose main
// job is being parseable and printable, not visually identical to the on-screen
// preview.

const styles = StyleSheet.create({
  page:      { paddingTop: 40, paddingBottom: 40, paddingHorizontal: 44, fontSize: 10, fontFamily: 'Helvetica', color: '#1a1a1a' },
  name:      { fontSize: 20, fontFamily: 'Helvetica-Bold', marginBottom: 3 },
  contact:   { fontSize: 9, color: '#555555', marginBottom: 14 },
  heading:   { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#2563eb', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 12, marginBottom: 5, borderBottomWidth: 1, borderBottomColor: '#2563eb', paddingBottom: 2 },
  summary:   { fontSize: 10, lineHeight: 1.4 },
  rowHead:   { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  title:     { fontSize: 10.5, fontFamily: 'Helvetica-Bold' },
  sub:       { fontSize: 9.5, color: '#555555' },
  dates:     { fontSize: 9, color: '#777777' },
  bulletRow: { flexDirection: 'row', marginTop: 2.5, paddingRight: 4 },
  bulletDot: { width: 10, fontSize: 10 },
  bulletTxt: { flex: 1, fontSize: 9.5, lineHeight: 1.35 },
  skillRow:  { flexDirection: 'row', marginTop: 2 },
  skillName: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', width: 110 },
  skillList: { fontSize: 9.5, flex: 1 },
})

function Bullet({ text }: { text: string }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletDot}>•</Text>
      <Text style={styles.bulletTxt}>{text}</Text>
    </View>
  )
}

function ResumeDocument({ d }: { d: ResumeData }) {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.name}>{d.name || ''}</Text>
        <Text style={styles.contact}>
          {[d.email, d.phone, d.location, d.linkedin].filter(Boolean).join('  ·  ')}
        </Text>

        {d.summary && (
          <>
            <Text style={styles.heading}>Summary</Text>
            <Text style={styles.summary}>{d.summary}</Text>
          </>
        )}

        {d.experience?.length > 0 && (
          <>
            <Text style={styles.heading}>Experience</Text>
            {d.experience.map((exp, i) => (
              <View key={i} wrap={false}>
                <View style={styles.rowHead}>
                  <Text style={styles.title}>{exp.title}{exp.company ? ` — ${exp.company}` : ''}</Text>
                  <Text style={styles.dates}>{exp.dates || ''}</Text>
                </View>
                {exp.location && <Text style={styles.sub}>{exp.location}</Text>}
                {(exp.bullets || []).map((b, bi) => <Bullet key={bi} text={b.text} />)}
              </View>
            ))}
          </>
        )}

        {d.education?.length > 0 && (
          <>
            <Text style={styles.heading}>Education</Text>
            {d.education.map((edu, i) => (
              <View key={i} style={styles.rowHead} wrap={false}>
                <Text style={styles.title}>
                  {edu.institution}{edu.degree ? ` — ${edu.degree}` : ''}{edu.field ? `, ${edu.field}` : ''}
                  {edu.gpa ? `  (GPA ${edu.gpa})` : ''}
                </Text>
                <Text style={styles.dates}>{edu.dates || ''}</Text>
              </View>
            ))}
          </>
        )}

        {d.skills?.categories?.length > 0 && (
          <>
            <Text style={styles.heading}>Skills</Text>
            {d.skills.categories.map((cat, i) => (
              <View key={i} style={styles.skillRow}>
                <Text style={styles.skillName}>{cat.name}</Text>
                <Text style={styles.skillList}>{cat.items.join(', ')}</Text>
              </View>
            ))}
          </>
        )}

        {d.projects?.length > 0 && (
          <>
            <Text style={styles.heading}>Projects</Text>
            {d.projects.map((p, i) => (
              <View key={i} wrap={false} style={{ marginTop: 6 }}>
                <Text style={styles.title}>{p.name}{p.tech ? `  —  ${p.tech}` : ''}</Text>
                {p.description && <Text style={[styles.summary, { marginTop: 1 }]}>{p.description}</Text>}
                {(p.bullets || []).map((b, bi) => <Bullet key={bi} text={b.text} />)}
              </View>
            ))}
          </>
        )}
      </Page>
    </Document>
  )
}

export async function buildResumePdf(d: ResumeData): Promise<Buffer> {
  return renderToBuffer(<ResumeDocument d={d} />)
}
