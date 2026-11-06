export interface Question {
  id: string;
  text: string;
  type: 'technical' | 'behavioral' | 'system_design' | 'general';
  difficulty: 'junior' | 'mid' | 'senior' | 'lead';
  modelAnswer: string;
  keywords: string[];
}

export interface MockRoleData {
  title: string;
  questions: Question[];
}

export const mockDatabase: Record<string, MockRoleData> = {
  software_engineer: {
    title: "Software Engineer",
    questions: [
      { id:"se_1", type:"technical", difficulty:"junior", text:"Can you explain the difference between 'let', 'const', and 'var' in JavaScript?", keywords:["scope","reassign","hoisting","block","redeclared","global"], modelAnswer:"'var' is function-scoped and hoisted. 'let' and 'const' are block-scoped. 'let' can be reassigned, 'const' cannot. Both sit in the temporal dead zone before declaration." },
      { id:"se_2", type:"technical", difficulty:"mid", text:"What is the Virtual DOM in React, and how does reconciliation work?", keywords:["reconciliation","diff","virtual","render","batching","tree","state change"], modelAnswer:"The Virtual DOM is an in-memory representation of the real DOM. React diffs old and new trees, computes minimal changes, and batches real DOM updates." },
      { id:"se_3", type:"system_design", difficulty:"senior", text:"How would you design a scalable real-time chat application for millions of users?", keywords:["websocket","redis","pub/sub","load balancer","horizontal","stateless","sharding","caching"], modelAnswer:"Stateless servers behind a load balancer, WebSocket connections, Redis Pub/Sub for cross-node messaging, database sharding by chat room, and background workers for persistence." },
      { id:"se_4", type:"behavioral", difficulty:"mid", text:"Describe a situation where you disagreed with a team member about a technical decision. How did you resolve it?", keywords:["disagreement","compromise","data","communication","collaborate","consensus","listen"], modelAnswer:"Use STAR: describe the situation, explain how you gathered data, facilitated discussion, and reached a consensus that delivered results." },
      { id:"se_5", type:"technical", difficulty:"senior", text:"Can you explain Time and Space Complexity and how to optimize an O(N^2) algorithm?", keywords:["big o","memoization","hash map","sorting","two pointers","nested loop","binary search"], modelAnswer:"Time complexity measures runtime scaling; space measures memory. O(N^2) can often be reduced to O(N log N) via sorting or O(N) via hash maps." },
      { id:"se_6", type:"technical", difficulty:"junior", text:"What is the difference between == and === in JavaScript?", keywords:["strict","type coercion","equality","comparison","truthy","falsy"], modelAnswer:"== performs type coercion before comparison, === checks value AND type without coercion. Always prefer === for predictable comparisons." },
      { id:"se_7", type:"technical", difficulty:"mid", text:"Explain closures in JavaScript and give a practical use case.", keywords:["closure","scope","lexical","function","variable","encapsulation","factory"], modelAnswer:"A closure is a function that retains access to its outer scope's variables even after the outer function returns. Used for data encapsulation, factory functions, and event handlers." },
      { id:"se_8", type:"behavioral", difficulty:"junior", text:"Tell me about a time you had to learn a new technology quickly for a project.", keywords:["learning","adaptability","deadline","resources","documentation","practice","deliver"], modelAnswer:"Describe the technology, the time constraint, resources you used, how you practiced, and the successful outcome." },
      { id:"se_9", type:"system_design", difficulty:"mid", text:"How would you design a URL shortener service like bit.ly?", keywords:["hash","base62","redirect","database","cache","collision","analytics","scale"], modelAnswer:"Generate a unique short code via base62 encoding or hashing, store the mapping in a database with a cache layer, handle redirects with 301/302, and track analytics." },
      { id:"se_10", type:"technical", difficulty:"senior", text:"What are microservices and how do they differ from a monolithic architecture?", keywords:["microservices","monolith","decoupled","api gateway","scaling","deployment","service mesh","fault isolation"], modelAnswer:"Microservices decompose an app into independently deployable services communicating via APIs. Benefits: independent scaling, fault isolation, team autonomy. Downsides: network complexity, data consistency." },
      { id:"se_11", type:"general", difficulty:"mid", text:"What motivates you as a software engineer and how do you stay current with technology?", keywords:["motivation","learning","community","side projects","conferences","open source","growth"], modelAnswer:"Discuss intrinsic motivation (problem-solving, impact), continuous learning habits (blogs, courses, open source contributions), and career growth goals." },
      { id:"se_12", type:"technical", difficulty:"lead", text:"How would you handle database migrations in a zero-downtime production environment?", keywords:["migration","backward compatible","blue-green","rolling","schema","feature flag","rollback"], modelAnswer:"Use backward-compatible schema changes, run migrations before code deploys, employ feature flags, blue-green deployments, and always have a rollback plan." },
    ]
  },
  product_manager: {
    title: "Product Manager",
    questions: [
      { id:"pm_1", type:"general", difficulty:"mid", text:"How do you prioritize features when stakeholders have competing demands?", keywords:["rice","impact","effort","priority","roi","stakeholders","alignment","customer value"], modelAnswer:"Use frameworks like RICE or MoSCoW, tie features to KPIs, and align stakeholders via data-driven workshops." },
      { id:"pm_2", type:"behavioral", difficulty:"mid", text:"Tell me about a product feature you launched that failed. What did you learn?", keywords:["fail","metric","feedback","user research","pivot","iteration","mvp"], modelAnswer:"Use STAR to describe the feature, how you measured failure, what user feedback revealed, and how you pivoted." },
      { id:"pm_3", type:"system_design", difficulty:"senior", text:"How would you design the onboarding flow for a B2B SaaS product to maximize 14-day retention?", keywords:["onboarding","retention","activation","time-to-value","analytics","tutorial","drop-off"], modelAnswer:"Minimize time-to-value with progressive disclosure, interactive tooltips, sandbox data, drop-off funnel tracking, and triggered re-engagement emails." },
      { id:"pm_4", type:"general", difficulty:"junior", text:"What is the difference between a product roadmap and a product backlog?", keywords:["roadmap","backlog","strategic","tactical","vision","sprint","prioritization","timeline"], modelAnswer:"A roadmap is a strategic high-level plan showing direction over time. A backlog is a tactical, ordered list of specific tasks and user stories for execution." },
      { id:"pm_5", type:"behavioral", difficulty:"senior", text:"Describe a time you had to say no to a powerful stakeholder. How did you handle it?", keywords:["stakeholder","data","trade-off","negotiate","empathy","alternative","impact"], modelAnswer:"Explain the request, why data didn't support it, how you presented alternatives, and the outcome of the negotiation." },
      { id:"pm_6", type:"technical", difficulty:"mid", text:"How do you use A/B testing to validate product decisions?", keywords:["hypothesis","control","variant","significance","sample size","conversion","metric","experiment"], modelAnswer:"Form a hypothesis, define success metrics, calculate needed sample size, run the experiment, achieve statistical significance, then decide." },
      { id:"pm_7", type:"general", difficulty:"mid", text:"How do you define and measure product-market fit?", keywords:["pmf","retention","survey","nps","growth","engagement","churn","sean ellis"], modelAnswer:"Use the Sean Ellis survey (40%+ 'very disappointed'), track retention curves, NPS, organic growth, and engagement depth." },
      { id:"pm_8", type:"behavioral", difficulty:"mid", text:"Tell me about a time you shipped a product under extreme time pressure.", keywords:["deadline","scope","trade-off","communication","mvp","risk","quality"], modelAnswer:"Describe the constraint, how you scoped down to MVP, communicated risks, rallied the team, and delivered on time." },
      { id:"pm_9", type:"system_design", difficulty:"mid", text:"How would you design a notification system that doesn't overwhelm users?", keywords:["notification","frequency","preference","batching","priority","channel","opt-out","personalization"], modelAnswer:"Implement user preference controls, intelligent batching/grouping, priority tiers, multi-channel routing, and frequency caps." },
      { id:"pm_10", type:"general", difficulty:"senior", text:"How do you balance technical debt against new feature development?", keywords:["tech debt","maintenance","velocity","refactor","sprint","capacity","long-term","investment"], modelAnswer:"Allocate a percentage of each sprint to tech debt, track its impact on velocity, and frame it as an investment in long-term speed." },
    ]
  },
  data_scientist: {
    title: "Data Scientist",
    questions: [
      { id:"ds_1", type:"technical", difficulty:"mid", text:"What is the difference between Overfitting and Underfitting, and how do you prevent them?", keywords:["overfitting","underfitting","regularization","cross-validation","bias","variance","dropout","noise"], modelAnswer:"Overfitting: high variance, learns noise. Fix: regularization, cross-validation, more data. Underfitting: high bias, too simple. Fix: more complex model, better features." },
      { id:"ds_2", type:"technical", difficulty:"mid", text:"Explain L1 vs L2 regularization. When would you use each?", keywords:["lasso","ridge","l1","l2","sparsity","coefficients","feature selection","squared"], modelAnswer:"L1 (Lasso) drives coefficients to zero for feature selection. L2 (Ridge) shrinks coefficients uniformly, better for collinear features." },
      { id:"ds_3", type:"technical", difficulty:"senior", text:"How would you handle a highly imbalanced classification dataset?", keywords:["imbalanced","smote","undersampling","oversampling","class weight","f1","auc","precision recall"], modelAnswer:"Use SMOTE/oversampling, adjust class weights, use appropriate metrics (F1, AUC-PR), ensemble methods, or collect more minority samples." },
      { id:"ds_4", type:"behavioral", difficulty:"mid", text:"Tell me about a time your model's results were challenged by a stakeholder.", keywords:["stakeholder","explain","visualization","trust","validation","business context","iterate"], modelAnswer:"Describe the challenge, how you explained the methodology, provided validation evidence, and iterated based on feedback." },
      { id:"ds_5", type:"technical", difficulty:"junior", text:"What is the difference between supervised and unsupervised learning?", keywords:["supervised","unsupervised","labels","classification","regression","clustering","dimensionality"], modelAnswer:"Supervised uses labeled data for classification/regression. Unsupervised finds patterns in unlabeled data via clustering or dimensionality reduction." },
      { id:"ds_6", type:"system_design", difficulty:"senior", text:"How would you design a real-time recommendation engine for an e-commerce platform?", keywords:["collaborative filtering","content-based","embedding","feature store","latency","a/b test","cold start","pipeline"], modelAnswer:"Combine collaborative filtering with content-based approaches, use a feature store for real-time features, handle cold starts, and validate with A/B tests." },
      { id:"ds_7", type:"technical", difficulty:"mid", text:"Explain the bias-variance tradeoff and how it affects model selection.", keywords:["bias","variance","tradeoff","complexity","generalization","error","overfit","underfit"], modelAnswer:"Bias is error from wrong assumptions; variance is sensitivity to training data. The goal is to minimize total error by balancing model complexity." },
      { id:"ds_8", type:"general", difficulty:"mid", text:"How do you communicate complex ML results to non-technical stakeholders?", keywords:["visualization","storytelling","simplify","business impact","dashboard","analogy","actionable"], modelAnswer:"Use clear visualizations, business-relevant metrics, analogies, and focus on actionable insights rather than technical details." },
      { id:"ds_9", type:"technical", difficulty:"senior", text:"What are transformers in NLP and why are they important?", keywords:["transformer","attention","self-attention","bert","gpt","parallelization","sequence","encoder decoder"], modelAnswer:"Transformers use self-attention to process all positions in parallel, enabling better long-range dependencies. Foundation of BERT, GPT, and modern NLP." },
      { id:"ds_10", type:"behavioral", difficulty:"junior", text:"How do you approach a new dataset you've never seen before?", keywords:["eda","exploration","distribution","missing values","correlation","outliers","visualization","hypothesis"], modelAnswer:"Start with EDA: check shape, types, missing values, distributions, correlations, outliers. Form hypotheses, then clean and prepare for modeling." },
    ]
  },
  marketing_specialist: {
    title: "Marketing Specialist",
    questions: [
      { id:"mkt_1", type:"general", difficulty:"mid", text:"How would you design a digital marketing campaign on a limited budget?", keywords:["organic","roi","micro-influencers","content marketing","seo","conversion rate","referrals"], modelAnswer:"Focus on high-ROI organic channels: micro-influencers, referral loops, SEO-optimized content, and short-form video for organic reach." },
      { id:"mkt_2", type:"technical", difficulty:"mid", text:"How do you measure the ROI of a social media marketing campaign?", keywords:["roi","attribution","conversion","cpc","cpa","analytics","funnel","engagement"], modelAnswer:"Track conversions via UTM parameters, calculate CPA/CPC, use multi-touch attribution models, and measure engagement-to-conversion funnels." },
      { id:"mkt_3", type:"behavioral", difficulty:"mid", text:"Tell me about a campaign that underperformed. What did you learn?", keywords:["failure","analysis","pivot","metric","audience","messaging","iterate","test"], modelAnswer:"Describe the campaign, metrics that showed underperformance, root cause analysis, and how you iterated to improve results." },
      { id:"mkt_4", type:"general", difficulty:"junior", text:"What is the difference between SEO and SEM?", keywords:["seo","sem","organic","paid","search","ranking","ads","keywords","long-term"], modelAnswer:"SEO is organic search optimization (free, long-term). SEM includes paid search ads (immediate, cost-per-click). Both aim to increase search visibility." },
      { id:"mkt_5", type:"system_design", difficulty:"senior", text:"How would you build a content marketing strategy for a B2B SaaS startup from scratch?", keywords:["content","funnel","persona","seo","distribution","thought leadership","lead gen","analytics"], modelAnswer:"Define buyer personas, map content to funnel stages, create SEO-driven blog/video content, distribute via email/social, and measure lead generation impact." },
      { id:"mkt_6", type:"behavioral", difficulty:"senior", text:"Describe a time you had to convince leadership to invest in a new marketing channel.", keywords:["persuade","data","pilot","budget","roi","presentation","results","stakeholder"], modelAnswer:"Present data-backed pilot proposal, show competitive analysis, run a small test, demonstrate ROI, and scale based on results." },
      { id:"mkt_7", type:"technical", difficulty:"mid", text:"How do you use A/B testing in email marketing?", keywords:["a/b test","subject line","open rate","click rate","sample","significance","variant","control"], modelAnswer:"Test one variable at a time (subject line, CTA, send time), use adequate sample sizes, measure open/click rates, achieve statistical significance before scaling." },
      { id:"mkt_8", type:"general", difficulty:"mid", text:"What is your approach to building and segmenting an email list?", keywords:["segmentation","persona","engagement","lead magnet","opt-in","personalization","automation","lifecycle"], modelAnswer:"Use lead magnets for opt-in, segment by behavior/demographics/lifecycle stage, personalize content, and automate drip sequences." },
      { id:"mkt_9", type:"technical", difficulty:"senior", text:"How would you set up marketing attribution across multiple channels?", keywords:["attribution","multi-touch","first-click","last-click","utm","analytics","crm","data pipeline"], modelAnswer:"Implement UTM tracking, integrate analytics with CRM, use multi-touch attribution models (linear, time-decay, or data-driven), and build dashboards." },
      { id:"mkt_10", type:"behavioral", difficulty:"junior", text:"How do you stay up to date with marketing trends and algorithm changes?", keywords:["learning","community","newsletter","experiment","platform updates","conference","continuous"], modelAnswer:"Follow industry newsletters, join communities, attend webinars, experiment with new features early, and share learnings with the team." },
    ]
  }
};

export const defaultRoles = Object.keys(mockDatabase).map(key => ({
  id: key,
  title: mockDatabase[key].title
}));

// Generates simulated review feedback for testing and offline modes
export function generateMockFeedback(_questionText: string, userResponse: string, keywords: string[]): {
  score: number;
  technicalScore: number;
  communicationScore: number;
  structureScore: number;
  strengths: string;
  weaknesses: string;
  feedback: string;
} {
  const trimmed = userResponse.trim();
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  
  if (wordCount < 5) {
    return {
      score: 30,
      technicalScore: 20,
      communicationScore: 40,
      structureScore: 30,
      strengths: "You attempted to answer the question.",
      weaknesses: "Your response is too short to evaluate. Please provide more detail in your answer.",
      feedback: "A complete answer requires explaining the context, technical details, and structure. Please expand your response."
    };
  }

  // Count matched keywords
  const matched = keywords.filter(kw => 
    userResponse.toLowerCase().includes(kw.toLowerCase())
  );
  const keywordRatio = matched.length / Math.max(1, keywords.length);
  
  // Calculate scores based on length & keywords
  const technicalScore = Math.min(100, Math.round(30 + keywordRatio * 60 + Math.min(10, wordCount / 10)));
  const communicationScore = Math.min(100, Math.round(40 + Math.min(40, wordCount / 5)));
  
  // Structure score boosts if STAR methods or sequencing words are found
  const structureKeywords = ["situation", "task", "action", "result", "first", "then", "second", "finally", "because", "therefore"];
  const structureMatches = structureKeywords.filter(w => userResponse.toLowerCase().includes(w));
  const structureScore = Math.min(100, Math.round(40 + structureMatches.length * 12 + Math.min(10, wordCount / 12)));

  const overallScore = Math.round((technicalScore + communicationScore + structureScore) / 3);

  // Generate dynamic feedback text
  let strengths = "";
  let weaknesses = "";
  let feedback = "";

  if (keywordRatio > 0.6) {
    strengths = `Excellent technical accuracy! You correctly mentioned key concepts like: ${matched.join(', ')}.`;
  } else if (keywordRatio > 0.2) {
    strengths = `Good start. You hit some key points such as: ${matched.join(', ')}.`;
  } else {
    strengths = "Your communication flow was clear, and you spoke at length.";
  }

  if (wordCount < 40) {
    weaknesses = "Your response is brief. You missed discussing broader architectural patterns or details.";
  } else if (matched.length < keywords.length / 2) {
    const missingKeywords = keywords.filter(kw => !matched.includes(kw));
    weaknesses = `You could deepen your response by explaining: ${missingKeywords.slice(0, 3).join(', ')}.`;
  } else {
    weaknesses = "Very solid coverage. To go from good to great, focus on providing specific personal project anecdotes.";
  }

  feedback = `Your answer shows a score of ${overallScore}%. ` +
    (overallScore >= 80 
      ? "You demonstrated a strong command of this topic. The explanation was fluent, using accurate industry jargon." 
      : overallScore >= 60 
      ? "You have a solid base understanding, but could benefit from structuring your answers more formally (e.g., using the STAR method for behavioral or stating complexity first for technical)." 
      : "We recommend reviewing the model answer and trying again, focusing on covering all core requirements and expanding on the concepts.");

  return {
    score: overallScore,
    technicalScore,
    communicationScore,
    structureScore,
    strengths,
    weaknesses,
    feedback
  };
}
