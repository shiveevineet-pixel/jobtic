import { forwardRef } from 'react';
import { EnhancedResumeData } from '../services/resumeService';

interface ResumeTemplateProps {
  data: EnhancedResumeData;
  preview?: boolean;
}

const ResumeTemplate = forwardRef<HTMLDivElement, ResumeTemplateProps>(({ data, preview = false }, ref) => {
  return (
    <div
      ref={ref}
      style={{
        width: preview ? '100%' : '210mm',
        minHeight: preview ? '300px' : '297mm',
        padding: preview ? '24px' : '20mm',
        overflowWrap: 'anywhere',
        background: 'white',
        color: 'black',
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '11pt',
        lineHeight: 1.5,
        boxSizing: 'border-box',
      }}
    >
      {/* Header / Personal Info */}
      <div style={{ textAlign: 'center', marginBottom: '16px' }}>
        <h1 style={{ fontSize: '24pt', fontWeight: 'bold', margin: '0 0 8px 0', textTransform: 'uppercase' }}>
          {data.personalInfo.name || '[Your Name]'}
        </h1>
        <div style={{ fontSize: '10pt', color: '#333', display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {data.personalInfo.location && <span>{data.personalInfo.location}</span>}
          {data.personalInfo.phone && <span>• {data.personalInfo.phone}</span>}
          {data.personalInfo.email && <span>• {data.personalInfo.email}</span>}
          {data.personalInfo.linkedin && <span>• {data.personalInfo.linkedin}</span>}
        </div>
      </div>

      {/* Summary */}
      {data.summary && (
        <div style={{ marginBottom: '16px' }}>
          <p style={{ margin: 0, textAlign: 'justify' }}>{data.summary}</p>
        </div>
      )}

      {/* Experience */}
      {data.experience && data.experience.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '14pt', fontWeight: 'bold', borderBottom: '1px solid black', margin: '0 0 8px 0', paddingBottom: '4px', textTransform: 'uppercase' }}>
            Professional Experience
          </h2>
          {data.experience.map((exp, idx) => (
            <div key={idx} style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div style={{ fontWeight: 'bold', fontSize: '12pt' }}>{exp.title}</div>
                <div style={{ fontSize: '10pt' }}>{exp.date}</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontStyle: 'italic', marginBottom: '4px' }}>
                <div>{exp.company}</div>
                <div style={{ fontSize: '10pt' }}>{exp.location}</div>
              </div>
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                {exp.bullets.map((bullet, bIdx) => (
                  <li key={bIdx} style={{ marginBottom: '4px', textAlign: 'justify' }}>{bullet}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* Projects */}
      {data.projects && data.projects.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '14pt', fontWeight: 'bold', borderBottom: '1px solid black', margin: '0 0 8px 0', paddingBottom: '4px', textTransform: 'uppercase' }}>
            Projects
          </h2>
          {data.projects.map((proj, idx) => (
            <div key={idx} style={{ marginBottom: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div style={{ fontWeight: 'bold' }}>
                  {proj.name} {proj.technologies && <span style={{ fontWeight: 'normal', fontStyle: 'italic' }}>| {proj.technologies}</span>}
                </div>
                <div style={{ fontSize: '10pt' }}>{proj.date}</div>
              </div>
              <p style={{ margin: '4px 0 0 0', textAlign: 'justify' }}>{proj.description}</p>
            </div>
          ))}
        </div>
      )}

      {/* Education */}
      {data.education && data.education.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '14pt', fontWeight: 'bold', borderBottom: '1px solid black', margin: '0 0 8px 0', paddingBottom: '4px', textTransform: 'uppercase' }}>
            Education
          </h2>
          {data.education.map((edu, idx) => (
            <div key={idx} style={{ marginBottom: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div style={{ fontWeight: 'bold' }}>{edu.school}</div>
                <div style={{ fontSize: '10pt' }}>{edu.date}</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div>{edu.degree}</div>
                <div style={{ fontSize: '10pt' }}>{edu.location}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Skills */}
      {data.skills && data.skills.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '14pt', fontWeight: 'bold', borderBottom: '1px solid black', margin: '0 0 8px 0', paddingBottom: '4px', textTransform: 'uppercase' }}>
            Skills
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {data.skills.map((skill, idx) => (
              <div key={idx}>
                <strong>{skill.category}:</strong> {skill.items.join(', ')}
              </div>
            ))}
          </div>
        </div>
      )}

      {data.certifications?.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '14pt', fontWeight: 'bold', borderBottom: '1px solid black', margin: '0 0 8px 0', paddingBottom: '4px', textTransform: 'uppercase' }}>
            Certifications
          </h2>
          {data.certifications.map((cert, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span><strong>{cert.name}</strong>{cert.issuer ? ` — ${cert.issuer}` : ''}</span>
              <span>{cert.date}</span>
            </div>
          ))}
        </div>
      )}

      {data.awards?.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '14pt', fontWeight: 'bold', borderBottom: '1px solid black', margin: '0 0 8px 0', paddingBottom: '4px', textTransform: 'uppercase' }}>
            Awards &amp; Achievements
          </h2>
          <ul style={{ margin: 0, paddingLeft: 20 }}>{data.awards.map((item, idx) => <li key={idx}>{item}</li>)}</ul>
        </div>
      )}

      {data.languages?.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '14pt', fontWeight: 'bold', borderBottom: '1px solid black', margin: '0 0 8px 0', paddingBottom: '4px', textTransform: 'uppercase' }}>
            Languages
          </h2>
          <div>{data.languages.join(' • ')}</div>
        </div>
      )}

      {data.additionalSections?.map((section, idx) => (
        section.title && section.items.length > 0 ? (
          <div key={idx} style={{ marginBottom: '16px' }}>
            <h2 style={{ fontSize: '14pt', fontWeight: 'bold', borderBottom: '1px solid black', margin: '0 0 8px 0', paddingBottom: '4px', textTransform: 'uppercase' }}>
              {section.title}
            </h2>
            <ul style={{ margin: 0, paddingLeft: 20 }}>{section.items.map((item, itemIdx) => <li key={itemIdx}>{item}</li>)}</ul>
          </div>
        ) : null
      ))}
    </div>
  );
});

export default ResumeTemplate;
