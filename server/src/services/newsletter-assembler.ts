import mjml2html from 'mjml';
import { convert } from 'html-to-text';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createCorrelatedLogger } from '../utils/logger';
import { config } from '../config';
import { WrittenNewsletter, AssembledNewsletter, NewsletterTheme, SectionNames } from 'shared';
import { DEFAULT_THEME, DEFAULT_SECTION_NAMES } from 'shared';

export class NewsletterAssemblerService {
  private templatePath: string;
  constructor(templatePath?: string) {
    this.templatePath = templatePath || join(__dirname, '..', 'templates', 'newsletter.mjml');
  }

  async assemble(
    writtenNewsletter: WrittenNewsletter, subjectLine: string,
    editionNumber: number, editionDate: string, correlationId: string,
    theme?: Partial<NewsletterTheme>, newsletterName?: string,
    sectionNames?: Partial<SectionNames>, headerImageUrl?: string,
    storyImages?: Record<string, string>, footerText?: string
  ): Promise<AssembledNewsletter> {
    const log = createCorrelatedLogger(correlationId, 'newsletter-assembler');
    const t = { ...DEFAULT_THEME, ...theme };
    const name = newsletterName || config.defaultNewsletterName;
    const sections = { ...DEFAULT_SECTION_NAMES, ...sectionNames };

    log.info('Assembling newsletter', { editionNumber, editionDate, subjectLine });

    const quickHitsHtml = writtenNewsletter.quickHits.map(qh => {
      const imgUrl = (qh as any).imageUrl || storyImages?.[qh.storyCandidateId] || '';
      const imgHtml = imgUrl ? `<mj-image src="${imgUrl}" alt="${qh.headline}" width="560px" padding-top="8px" padding-bottom="16px" />` : '';
      return `<mj-text font-size="18px" font-weight="bold" padding-top="16px">${qh.headline}</mj-text>\n<mj-text padding-top="4px">${qh.htmlContent}</mj-text>\n${imgHtml}`;
    }).join('\n');

    const watchListHtml = writtenNewsletter.watchList.map(wl => {
      const imgUrl = (wl as any).imageUrl || storyImages?.[wl.storyCandidateId] || '';
      const imgHtml = imgUrl ? `<mj-image src="${imgUrl}" alt="${wl.headline}" width="560px" padding-top="8px" padding-bottom="16px" />` : '';
      return `<mj-text font-size="16px" font-weight="bold" padding-top="12px">${wl.headline}</mj-text>\n<mj-text padding-top="4px">${wl.htmlContent}</mj-text>\n${imgHtml}`;
    }).join('\n');

    let mjmlTemplate: string;
    try { mjmlTemplate = readFileSync(this.templatePath, 'utf-8'); }
    catch { mjmlTemplate = this.getFallbackTemplate(); }

    // Lead story image — placed after the story content
    const leadImgUrl = (writtenNewsletter.leadStory as any).imageUrl || storyImages?.[writtenNewsletter.leadStory.storyCandidateId] || '';
    const leadImgHtml = leadImgUrl
      ? `<mj-image src="${leadImgUrl}" alt="${writtenNewsletter.leadStory.headline}" width="560px" padding-top="8px" padding-bottom="8px" />`
      : '';

    const populated = mjmlTemplate
      .replace(/\{\{newsletterName\}\}/g, name)
      .replace(/\{\{editionNumber\}\}/g, String(editionNumber))
      .replace(/\{\{editionDate\}\}/g, editionDate)
      .replace(/\{\{leadSectionName\}\}/g, sections.lead)
      .replace(/\{\{briefingSectionName\}\}/g, sections.briefing)
      .replace(/\{\{watchSectionName\}\}/g, sections.watch)
      .replace(/\{\{leadStoryHeadline\}\}/g, writtenNewsletter.leadStory.headline)
      .replace(/\{\{leadStoryContent\}\}/g, writtenNewsletter.leadStory.htmlContent)
      .replace(/\{\{leadStoryImage\}\}/g, leadImgHtml)
      .replace(/\{\{quickHitsContent\}\}/g, quickHitsHtml)
      .replace(/\{\{watchListContent\}\}/g, watchListHtml)
      .replace(/\{\{unsubscribeUrl\}\}/g, config.unsubscribeUrl)
      .replace(/\{\{physicalAddress\}\}/g, config.physicalAddress)
      .replace(/\{\{headerColor\}\}/g, t.headerColor || '#0f3460')
      .replace(/\{\{accentColor\}\}/g, t.accentColor || '#0f3460')
      .replace(/\{\{backgroundColor\}\}/g, t.backgroundColor || '#f4f4f8')
      .replace(/\{\{cardColor\}\}/g, t.cardColor || '#ffffff')
      .replace(/\{\{textColor\}\}/g, t.textColor || '#1a1a2e')
      .replace(/\{\{footerColor\}\}/g, t.footerColor || '#1a1a2e')
      .replace(/\{\{fontFamily\}\}/g, t.fontFamily || "Georgia, 'Times New Roman', serif")
      .replace(/\{\{footerText\}\}/g, footerText || '')
      .replace(/\{\{headerImageUrl\}\}/g, headerImageUrl || '');

    let html: string;
    try {
      const result = mjml2html(populated, { validationLevel: 'soft' });
      html = result.html;
    } catch (err: any) {
      log.error('MJML compilation failed', { error: err.message });
      html = `<html><body><h1>${name}</h1><p>Edition #${editionNumber}</p></body></html>`;
    }

    const plainText = this.generatePlainText(writtenNewsletter, editionNumber, editionDate, name, sections);
    const sectionMetadata = [
      { role: 'lead_story', headline: writtenNewsletter.leadStory.headline, wordCount: writtenNewsletter.leadStory.wordCount },
      ...writtenNewsletter.quickHits.map(qh => ({ role: 'quick_hit', headline: qh.headline, wordCount: qh.wordCount })),
      ...writtenNewsletter.watchList.map(wl => ({ role: 'watch_list', headline: wl.headline, wordCount: wl.wordCount })),
    ];
    log.info('Newsletter assembled', { htmlLength: html.length, plainTextLength: plainText.length, sections: sectionMetadata.length });
    return { html, plainText, editionNumber, editionDate, sectionMetadata };
  }

  private generatePlainText(nl: WrittenNewsletter, num: number, date: string, name: string, sections: SectionNames): string {
    const lines = [`${name} — Edition #${num} — ${date}`, '='.repeat(60), '', sections.lead.toUpperCase(), '-'.repeat(40), nl.leadStory.headline, '', nl.leadStory.plainTextContent || convert(nl.leadStory.htmlContent, { wordwrap: 72 }), '', sections.briefing.toUpperCase(), '-'.repeat(40)];
    for (const qh of nl.quickHits) { lines.push(`• ${qh.headline}`, qh.plainTextContent || convert(qh.htmlContent, { wordwrap: 72 }), ''); }
    lines.push(sections.watch.toUpperCase(), '-'.repeat(40));
    for (const wl of nl.watchList) { lines.push(`• ${wl.headline}`, wl.plainTextContent || convert(wl.htmlContent, { wordwrap: 72 }), ''); }
    lines.push('-'.repeat(60), `Unsubscribe: ${config.unsubscribeUrl}`, config.physicalAddress);
    return lines.join('\n');
  }

  private getFallbackTemplate(): string {
    return `<mjml><mj-body background-color="{{backgroundColor}}">
      <mj-section background-color="{{headerColor}}" padding="20px"><mj-column>
        <mj-text color="#fff" font-size="24px" align="center">{{newsletterName}}</mj-text>
        <mj-text color="#ddd" font-size="13px" align="center">Edition #{{editionNumber}} — {{editionDate}}</mj-text>
      </mj-column></mj-section>
      <mj-section background-color="{{cardColor}}" padding="20px"><mj-column>
        <mj-text font-size="12px" color="{{accentColor}}" font-weight="bold" text-transform="uppercase">{{leadSectionName}}</mj-text>
        <mj-text font-size="20px" font-weight="bold">{{leadStoryHeadline}}</mj-text>
        <mj-text>{{leadStoryContent}}</mj-text>
        {{leadStoryImage}}
      </mj-column></mj-section>
      <mj-section background-color="{{cardColor}}" padding="20px"><mj-column>
        <mj-text font-size="12px" color="{{accentColor}}" font-weight="bold" text-transform="uppercase">{{briefingSectionName}}</mj-text>
        {{quickHitsContent}}
      </mj-column></mj-section>
      <mj-section background-color="{{cardColor}}" padding="20px"><mj-column>
        <mj-text font-size="12px" color="{{accentColor}}" font-weight="bold" text-transform="uppercase">{{watchSectionName}}</mj-text>
        {{watchListContent}}
      </mj-column></mj-section>
      <mj-section background-color="{{footerColor}}" padding="16px"><mj-column>
        <mj-text color="#aaa" font-size="11px" align="center"><a href="{{unsubscribeUrl}}" style="color:#aaa">Unsubscribe</a> | {{physicalAddress}}</mj-text>
      </mj-column></mj-section>
    </mj-body></mjml>`;
  }
}
