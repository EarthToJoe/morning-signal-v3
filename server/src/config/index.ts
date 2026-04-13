import dotenv from 'dotenv';
dotenv.config();

export const config = {
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  parallelAiApiKey: process.env.PARALLEL_AI_API_KEY || '',
  sendGridApiKey: process.env.SENDGRID_API_KEY || '',
  sendGridFromEmail: process.env.SENDGRID_FROM_EMAIL || 'newsletter@example.com',
  sendGridFromName: process.env.SENDGRID_FROM_NAME || 'Morning Signal',
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'postgres',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.DB_SSL === 'true',
  },
  llmModels: {
    contentResearcher: process.env.LLM_MODEL_RESEARCHER || 'gpt-5.4',
    storyWriterLead: process.env.LLM_MODEL_WRITER_LEAD || 'gpt-5.4',
    storyWriterBriefings: process.env.LLM_MODEL_WRITER_BRIEFINGS || 'gpt-5.4',
    subjectLineGenerator: process.env.LLM_MODEL_SUBJECT_LINE || 'gpt-5.4',
  },
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  costBudgetPerEdition: parseFloat(process.env.COST_BUDGET_PER_EDITION || '1.00'),
  defaultNewsletterName: process.env.DEFAULT_NEWSLETTER_NAME || 'Morning Signal',
  unsubscribeUrl: process.env.UNSUBSCRIBE_URL || 'https://example.com/unsubscribe',
  physicalAddress: process.env.PHYSICAL_ADDRESS || '123 Main St, Washington, DC 20001',
};
