# -*- coding: utf-8 -*-
# NODE 0 - 60 英文翻译
TRANS_A = [
# 0
"Design and Implementation of a Dynamic Job-Skill Knowledge Graph Construction and Talent Matching System Based on Multi-Source Recruitment Data",
# 1
"\u00b9School of Artificial Intelligence and Big Data, Henan University of Technology, Zhengzhou, Henan, China",
# 2 Résumé
"Abstract: The rapid expansion of the digital economy has made the technology-stack update cycle significantly shorter than the traditional talent-training cycle; the labor market simultaneously exhibits two phenomena: enterprises struggle to recruit, and workers lack clear career paths. Public recruitment texts constitute an important signal source for observing skill demands, but their temporal lag, homogeneous duplication, and expression noise directly contaminate the downstream graph and matching results. Faced with the cross-validation of data cleaning and the hallucination control of AI models, this paper presents, on an engineered system covering tens of thousands of real job postings, five verifiable innovations whose full chain has been implemented: (1) quality control based on content fingerprints and the completeness of fifteen fields, which moves reliability upstream to database insertion triggers; (2) emerging-job discovery based on a three-dimensional emergence measure and a six-step reasoning chain, whose conclusions carry the counting of evidence sources; (3) multi-source pseudo-temporal skill differencing, which labels additions, deletions, and modifications by means of a recomputable $\\Delta_s$; (4) five-dimensional matching with weights of $0.42/0.24/0.14/0.10/0.10$, an upper bound of $0.65$ being applied to the graph-transfer contribution; (5) evidence-based control with $|S|\\!\\ge\\!2$ and a local heuristic fallback to suppress hallucinations. In the online evaluation, the average accuracies of JD parsing, resume extraction, and job\u2013candidate matching are no lower than 90%; the F1 of emerging-job discovery is 0.824, and the Kappa of evolution relative to expert annotations is 0.76. The paper as a whole coherently organizes the formulas, pseudocode, comparative experiments, and ablations, so that the proposed innovations are supported by both data and implementation.",
# 3 Mots-clés
"Keywords: job-skill knowledge graph; dynamic evolution analysis; multi-source heterogeneous data governance; emerging-job discovery; job\u2013candidate matching; retrieval-augmented generation; hallucination control",
# 4
"The current job market is faced with a structural contradiction: the iteration pace of technology stacks is faster than the talent-training cycle, while enterprises struggle to recruit and workers lack clear career paths. Although public recruitment texts constitute an important signal source for observing skill demands, they commonly suffer from publication delays, template copies, and expression noise, which directly contaminate the downstream knowledge extraction and matching results; traditional recruitment, moreover, relies largely on keyword comparison, which makes it difficult to characterize the dynamic evolution of job skill structures, while large language models also easily produce hallucinations due to the lack of evidence in job-definition generation and diagnostic dialogues. To address these problems, this paper designs and implements a dynamic job-skill knowledge graph construction and intelligent matching system for the job market, named \u201cZhiTuPoJu\u201d (breaking through the situation by means of graphs): taking jobs and skills as central entities, it integrates multi-source data collection and governance, Neo4j graph construction, RAG reasoning with hallucination control, and multidimensional job\u2013candidate matching, forming a closed loop that includes emerging-job discovery, dynamic skill updates, panoramic visualization at the skill-point level, and CV-based diagnostic analysis; the accuracies of JD parsing, resume extraction, and matching all exceed 90%, thereby supporting enterprise recruitment, career planning, and talent-trend assessment.",
# 5
"Abroad, research on job-skill knowledge graphs is relatively mature: relatively complete occupational classifications, skill frameworks, and job standards have been established, and dynamic data such as recruitment information and training resources are further integrated to construct job-skill knowledge graphs. For example, some studies use recruitment data to continuously update the associations between skills and occupations, and combine graph neural networks, knowledge-graph reasoning, and large language models for skill prediction, job matching, and career-path planning. In recent years, the research focus has gradually shifted from static knowledge representation to temporal modeling and dynamic evolution, in order to meet the needs of a rapidly changing labor market.",
# 6
"In China, research on job-skill knowledge graphs started later and is currently focused mainly on mining recruitment information, analyzing occupational skills, and job\u2013candidate matching. Researchers are progressively exploiting multi-source heterogeneous data \u2014 recruitment sites, occupational standards, training resources \u2014 to extract jobs, skills, and their relations through natural language processing and knowledge-graph techniques, thereby achieving a structured expression of job demands that is subsequently applied to talent recommendation and career planning. However, existing work remains mostly centered on static knowledge organization and single-scenario applications; studies on the dynamic changes in job demands driven by industrial development and on the continuous evolution of knowledge graphs remain relatively insufficient.",
# 7
"Overall, domestic and international research acknowledges the important value of multi-source data fusion and knowledge graphs for job-skill analysis, but problems remain: scattered data sources, difficulty in fusing heterogeneous data, and insufficient characterization of the dynamic variations of job-skill relations. Existing methods most often address a single link \u2014 knowledge-graph construction or job matching \u2014 and studies covering the complete closed loop \u201cdata collection \u2014 knowledge extraction \u2014 graph construction \u2014 dynamic update \u2014 evolution analysis\u201d remain insufficient. Therefore, it is necessary to build a multi-source heterogeneous job-skill knowledge graph for the job market, so as to dynamically characterize the evolution of job demands and of the skill structure.",
# 8
"III. System Design and Implementation",
# 9
"3.1 System Architecture",
# 10
"The system is organized overall into three layers: input layer, processing layer, and output layer (Figure 1). The input layer receives multi-source corpora such as JDs from recruitment platforms, supplementary fields provided by enterprises, and user resumes; the processing layer ensures data governance, knowledge-graph construction, emerging-job discovery, skill-evolution differencing, and job\u2013candidate matching; the output layer provides enterprises and candidates with structured job definitions, skill-evolution differentials, matching diagnostic reports, and regional talent-trend dashboards,",
# 11
"Figure 1. \u201cInput\u2013Hidden\u2013Output\u201d Overall Research Framework of the System",
# 12
"as well as evidence-constrained dialogue responses. The enlarged insets at the four corners of Figure 1 correspond to the central innovations described later; each of them is accompanied by a formal definition, implementation thresholds, and quantitative evidence, so as to avoid presenting mere diagrams without formal support.",
# 13
"Functionally, the system forms a chain of four links: \u201ccollection and governance \u2014 graph services \u2014 intelligent analysis \u2014 application interaction\u201d. The collection-and-governance component ensures multi-source insertion, fingerprint-based deduplication, completeness scoring, and inter-source cross-validation; the graph-services component organizes jobs, skills, industries, and enterprises, together with their relations, into a queryable weighted directed graph, and supports visualizations such as regional heat maps and job-skill mind maps; the intelligent-analysis component ensures emerging-job discovery, the evolution of the skills of existing jobs, and five-dimensional job\u2013candidate matching; the application-interaction component corresponds to the front-end modules such as the digital talent map, job insight, new-job discovery, job\u2013candidate matching, and the resume assistant, realizing a closed loop from regional trends to individual diagnosis. Technically, FastAPI provides a unified REST interface, PostgreSQL hosts the main job data and the user center, Neo4j handles graph queries, and the front end organizes the various business views in a multi-page shell; large language models are used only for editorial polishing and semantic review, while the central discovery, evolution, and matching paths retain a model-free heuristic implementation, so as to guarantee service degradability and result reproducibility.",
# 14
"The design objectives of the system can be summarized as follows: verifiable input data, queryable graph relations, recomputable evolution differentials, and actionable matching conclusions. The corresponding design constraint is that any conclusion such as \u201cemerging-job definition\u201d or \u201cremoved skill\u201d must be able to point back to a precise set of samples or a differential formula, thereby ensuring that conclusions are auditable and reproducible. At the data layer,",
# 15
"Figure 2. Database Tables and Fields",
# 16
"The main job data are split between a main lookup table and a detail table, linked to each other by a foreign key in a 1:1 relation, as shown in Figure 2. The main table carries the high-frequency filtering fields (source, title, company, city, salary, experience, education level, publication date, fingerprint, completeness, etc.), while the detail table carries long-text and array-type fields (description, requirements, skill table, benefits, hierarchical categories, etc.); platform-specific fields are stored in JSONB to avoid frequent schema modifications [1]. Letting $P$ denote the tuple of the main table and $D$ that of the detail table, they satisfy the foreign-key constraint $D.job_id=P.id$.",
# 17
"Completeness computes the proportion of non-empty fields over fifteen key fields:",
# 18
"In practice, records satisfying $c(p)<60%$ are marked as low quality and, by default, do not enter the high-confidence sample pool of discovery and evolution. On the search side, pg_trgm GIN and btree_gin are deployed so that fuzzy matching on titles and composite filters can use indexes. Inter-source cross-validation compares the fingerprints and publication dates of the same logical job across different source_name values, and provides inputs for the evidence counting of the discovery module [2].",
# 19
"3.2 System Innovations",
# 20
"Innovation I1: (quality control, corresponding to the upper-left corner of Figure 1). For each job record, the content fingerprint and the completeness of fifteen fields are computed; scoring and deduplication are performed automatically in database triggers, so as to prevent at the source delayed samples, \u201cempty-shell\u201d samples, and template copies from entering the graph. Formally,",
# 21
"denotes the central string obtained by concatenating the title, the company, the city, the salary, the experience, and the education level. The control rule requires",
# 22
"for a record to enter the high-confidence pool of discovery/evolution. Data: after deduplication over the three sources, 12495 valid records, of which 11680 are high-quality (93.5%); the intra-source deduplication rate is about 15%\u201320%; a completeness example",
# 23
"is considered compliant and inserted into the database.",
# 24
"Innovation I2: (three-dimensional emergence measure and six-step reasoning chain, corresponding to the discovery segment of Figure 1). For a cluster of titles",
# 25
", we define",
# 26
"and we produce a replayable six-step chain: integration \u2192 disambiguation \u2192 scoring \u2192 definition \u2192 extrapolation \u2192 audit. Data: over 23 expert-annotated categories, the precision is 0.750, the recall 0.913, and the F1 0.824; the case study",
# 27
"Innovation I3: (multi-source pseudo-temporal skill differencing, corresponding to the lower-left corner of Figure 1). The difference between the occurrence rates of the older source",
# 28
"and the more recent source",
# 29
", denoted",
# 30
", makes it possible to determine the additions, deletions, and modifications, writing \u201cskill evolution\u201d as a recomputable difference rather than as a descriptive narrative. Data: the Kappa of consistency between the evolution and the expert annotations is 0.76; illustrative differences such as RAG",
# 31
"are on the order of a few percentage points (recomputed with the same extractor and on the same job class).",
# 32
"Innovation I4: (five-dimensional weighted matching and transfer upper bound, corresponding to the upper-right corner of Figure 1). The total score",
# 33
"prevents weakly correlated skills from being artificially overvalued. Data: the matching accuracy is 0.927 (90% threshold); the ablation removing the skill dimension makes it drop by 8.4 percentage points, which shows that the weight configuration is consistent with experience.",
# 34
"Innovation I5: (evidence-based control and hallucination prevention, corresponding to the lower-right corner of Figure 1 and to Chapter VIII). Discovery/generation conclusions require a number of evidence sources",
# 35
", failing which they are marked low_evidence and subjected to mandatory manual review; on the dialogue side, inventing out-of-context job identifiers is forbidden, and when the LLM is unavailable, the system falls back to the local heuristic. Data: the unaudited hallucination rate is about 18.7%, and about 3.2% after control; the central matching/discovery paths remain reproducible without an API key.",
# 36
"3.3 System Implementation",
# 37
"The implementation of the system unfolds according to \u201cgraph construction \u2014 emerging-job discovery \u2014 skill evolution \u2014 job\u2013candidate matching \u2014 hallucination prevention in dialogue \u2014 experimental validation\u201d, and corresponds one-to-one to the preceding innovations. The skill knowledge graph is defined as a weighted directed graph: the nodes comprise jobs, skills, industries, and enterprises; the edges cover four types of relations \u2014 job-skill, job-industry, enterprise-job, and skill-skill \u2014 as shown in Figure 3. On the entity side, jobs, enterprises, and industries mainly come from structured fields; skills come from the skill tables of the detail table and from the longest dictionary match applied to the description text, with alias normalization; unknown aliases may be extracted with the help of a large language model, but must be confirmed manually or through the dictionary before insertion into the database. When a new batch arrives, only the weights of the edges of the affected jobs are recomputed; the digital talent map then aggregates heat and salaries by province and city, supporting top-down regional analysis and job-skill mind maps.",
# 38
"Emerging-job discovery is carried out by means of a six-step reasoning chain: multi-source integration, semantic disambiguation and clustering, emergence scoring, definition generation, trend extrapolation, and evidence audit. The definition fields give priority to statistics from real JDs; the large language model only polishes and cannot add skills absent from the evidence; when the evidence comes from fewer than two independent sources, the item is marked as low-evidence and passed to human intervention. The evolution of the skills of existing jobs computes, on the older and more recent sources, the difference of the occurrence rates with the same extractor, so as to determine the additions, deletions, and modifications, as shown in Figure 5. The results are accompanied by the sample size and the source information to facilitate verification. Job\u2013candidate matching adopts a five-dimensional weighting \u2014 skills, semantics, project, experience, and graph \u2014 (with the following weight distribution: $0.42/0.24/0.14/0.10/0.10$), sets an upper bound on the transfer contribution, and generates learning paths according to the gaps, as shown in Figure 7; the resume assistant records STAR experiences in the profile as an input to the matching. On the dialogue side, inventing out-of-context jobs is forbidden; in case of structured-output validation failure or missing API key, the system falls back to local models; the central discovery and evolution paths always retain a large-language-model-free heuristic path.",
# 39
"The experimental environment is Windows 11, Python 3.12, PostgreSQL, and FastAPI; when DeepSeek is unavailable, automatic degradation occurs. After deduplication, about 12500 valid jobs are counted, of which about 93.5% are high-quality; the graph comprises about 5747 nodes and 13081 edges. The accuracies of JD parsing, resume extraction, and job\u2013candidate matching are 93.9%, 91.0%, and 92.7%, respectively; the F1 of emerging-job discovery is 0.824, and the Kappa of consistency between evolution and experts is 0.76. The limitations mainly concern an observation window that is too short, the possible invalidity of the pseudo-temporal hypothesis in multi-source synchronous-update scenarios, and the fact that infrequent out-of-dictionary skills still require manual intervention. Overall, governance, graph construction, discovery, evolution, and matching diagnosis can be chained into a verifiable pipeline on real recruitment corpora.",
# 40
"3.4 Formal Definition of the Graph",
# 41
"The skill knowledge graph is defined as a weighted directed graph",
# 42
". The set of nodes",
# 43
"where",
# 44
"denotes the jobs,",
# 45
"the skills,",
# 46
"the industries, and",
# 47
"the enterprises. The set of edges comprises four types of relations:",
# 48
", linking respectively job-skill, job-industry, enterprise-job, and skill-skill. See Figure 3",
# 49
"The weight of the REQUIRES edge, denoted",
# 50
", takes the occurrence frequency of the skill",
# 51
"The RELATED_TO edge is jointly constrained by co-occurrence and the manually established transfer dictionary, thereby providing a prior for _relation_transfer of the matching module.",
# 52
"Building on the preceding analysis of jobs, skills, industries, and enterprises, this paper represents the job-skill knowledge graph as a weighted directed graph describing the relations between different entities. Its basic formal definition is as follows:",
# 53
"where V is the set of entity nodes of the graph, E the set of relations between entities, and W the set of weights associated with the relations. According to the data types actually used by the system, the nodes fall mainly into four categories \u2014 jobs, skills, industries, and enterprises \u2014 namely:",
# 54
"V=Vposte\u222aVcomp\u00e9tences\u222aVsecteurs\u222aVentreprises",
# 55
"where Vposte denotes the set of job entities, Vcomp\u00e9tences the set of skill entities, Vsecteurs the set of industry entities, and Ventreprises the set of enterprise entities. Jobs and skills are the central nodes of the whole graph; industries and enterprises mainly serve to complete the business environment of jobs and the information about recruiting entities.",
# 56
"Regarding the design of the relations, this paper does not simply connect all the entities together, but organizes them according to the semantic relations actually present in the recruitment data. The graph relations mainly include the job-skill requirement relation, the job-industry membership relation, the enterprise-job recruitment relation, and the skill-skill association relation; the set of relations can be written as:",
# 57
"where Ebesoins denotes the requirement relation between a job and a skill, corresponding to REQUIRES in the graph; Eappartenance the membership relation between a job and an industry, corresponding to BELONGS_TO; Erecrutement the recruitment relation between an enterprise and a job, corresponding to RECRUITS; Eassociation the association relation between different skills, corresponding to RELATED_TO.",
# 58
"For the job technology graph, the requirement relation between a job and a skill is the most important. Consequently, this paper describes the association between a job and a skill in the form of a triplet:",
# 59
"(job,REQUIRES,skill)",
# 60
"(Java Developer,REQUIRES,Spring Boot)",
]
