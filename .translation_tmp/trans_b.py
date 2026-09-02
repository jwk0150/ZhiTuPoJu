# -*- coding: utf-8 -*-
# NODE 61 - 120 英文翻译
TRANS_B = [
# 61
"indicates that, in the recruitment data, the Java developer job has a requirement for the Spring Boot skill. In this way, the information scattered in the job description, the job requirements, and the skill fields of the recruitment postings can be uniformly converted into a graph structure, thereby providing the data foundation for the subsequent visualization of the job technology graph and for job\u2013candidate matching.",
# 62
"Considering that the occurrence frequencies of different skills within the same job are not identical, this paper further defines weights for the job-skill relations. Let Dposte be the set of valid recruitment postings corresponding to a given job, and n(poste,s) the number of occurrences of skill s in the recruitment postings of this job; the requirement weight between the job and the skill is then defined as:",
# 63
"where (Dposte) represents the total number of valid recruitment postings corresponding to the job, and n(poste,s) the number of occurrences of skill s in these postings. The larger this value, the more frequently the skill appears in the recruitment requirements of the job concerned, and the higher its importance in the job technology structure. The edge weight makes it possible to avoid a binary judgment based solely on the presence or absence of the skill, and the graph can thus reflect more finely the differences in the level of requirement among the skills.",
# 64
"The graph in this paper is not static. Recruitment platforms continuously produce new postings, and the technical skill demands of enterprises evolve with technological development and industrial shifts. Therefore, building on the preceding static structure, a time variable t is introduced, and the job-skill knowledge graph under a given time window is represented as:",
# 65
"where V\u209c, E\u209c, and W\u209c denote respectively the set of nodes, the set of relations, and the set of relation weights corresponding to time t. When new recruitment data enter the system, there is no need to recompute the entire graph: it suffices to recompute the weights of the edges of the modified jobs and of their associated skills, thereby achieving an incremental update of the graph.",
# 66
"Moreover, the variation in the demand of the same job and of the same skill between different time windows can be expressed as:",
# 67
"where w\u209c\u2081(poste,s) and w\u209c\u2082(poste,s) denote respectively the weights of the job-skill relation in two different statistical time windows. When \u0394w is greater than 0, the recruitment demand for this skill has strengthened in the later time window; when \u0394w is lower than 0, the demand has decreased; when \u0394w is equal to 0, the variation between the two windows is not significant. This indicator also provides a quantitative basis for the subsequent analysis of the dynamic evolution of job skills.",
# 68
"Overall, the job-skill knowledge graph in this paper can be summarized in four components: \u201centities, relations, weights, and time\u201d. The entities describe the jobs, skills, industries, and enterprises of the recruitment market; the relations express the semantic links between the different entities; the weights reflect the degree of demand of the jobs for the skills; the time dimension records the evolution of the skill structure of the jobs. This design satisfies the visualization needs of the job technology graph and remains consistent with the subsequent modules of entity normalization, relation inference, edge-weight update, job-skill evolution, and job\u2013candidate matching.",
# 69
"In recent years, knowledge graphs have gradually moved from static knowledge organization to dynamic knowledge representation. Peng et al. conducted a systematic review of the works on knowledge graphs, emphasizing that they allow the structural representation of complex domain knowledge by means of entities and relations, and further support knowledge fusion and reasoning [3]. Goyal et al. proposed JobXMLC for the recruitment scenario, organizing jobs and skills into a job-skill graph structure and using this structure for job-skill prediction, showing that the structured job-skill relations constitute an effective data foundation for skill analysis in the recruitment domain [4]. Seif et al. proposed a dynamic Jobs-Skills knowledge graph, combining jobs, skills, and labor-market data and taking into account the variations of the recruitment market over time, providing a new research direction for the dynamic modeling of job-skill relations [5]. Building on these works, this paper adds a temporal dimension to the traditional job-skill graph and updates the relation weights by the occurrence frequencies of the skills in the recruitment data, thereby forming a dynamic job-skill knowledge graph adapted to real recruitment data.",
# 70
"3.5 Entity Extraction and Normalization",
# 71
"The job, enterprise, and industry entities mainly come from structured fields. The skill entities come from the skill table of the detail table and from the dictionary scanning of the description text, as shown in Figure 4. The system maintains a skill vocabulary grouped by technology stack",
# 72
"(backend, frontend, artificial intelligence, big data, cloud computing, mobile, testing, operations, algorithms, general tools, etc.), and applies longest-match-first to the text:",
# 73
"appears in",
# 74
"",
# 75
". This method offers a stable and reproducible recall, with a linear complexity with respect to the text length. For unknown aliases, extraction assisted by a large language model is allowed, but it must be confirmed by the dictionary or manually before being written into the graph, so as to avoid generative skill names polluting the whole set of nodes [6].",
# 76
"Figure 4. Example of Data in the Detail Table",
# 77
"3.6 Relation Inference and Edge-Weight Update",
# 78
"REQUIRES is established directly by the job-skill co-occurrence; BELONGS_TO is mapped from the industry field; RECRUITS links the entities from the company field; RELATED_TO combines the co-occurrence counting and the confidence of the transfer table. Let",
# 79
"be the sample size of the job",
# 80
"the number of occurrences of the skill",
# 81
"When a new batch is inserted, it suffices to recompute the weights of the edges of the affected jobs, without rebuilding the entire graph. For high-frequency queries (the adjacent jobs of a given skill, the shortest bridging path between two skills), materialized views or caches may be created.",
# 82
"3.7 Discovery and Prediction of Emerging Jobs",
# 83
"Problem formulation and six-step reasoning chain: emerging-job discovery must identify, outside the standard frameworks, the \u201cemerging\u201d job clusters and provide an auditable definition. A scanning pass is denoted as a six-component reasoning chain",
# 84
", where",
# 85
"The six steps are respectively: multi-source data integration, semantic disambiguation and clustering, multidimensional emergence scoring, job-definition generation, trend extrapolation, and evidence audit. Figure 5 presents the data flow from collection to decision.",
# 86
"Figure 5. New-Job Discovery and Prediction Page",
# 87
"Three-dimensional emergence scoring: for a cluster",
# 88
"is the sum of the three components (in accordance with _score_group_detailed in backend/routers/discovery.py):",
# 89
"where",
# 90
"is the title novelty,",
# 91
"the skill-combination score, and",
# 92
"the cross-industry overflow. The meaning of the symbols is given in Table 2. The auxiliary growth quantity over the last 30 days",
# 93
"where",
# 94
"is the number of samples published within the cluster over the last 30 days;",
# 95
"Job-definition generation and future-direction correction: the definition object",
# 96
"comprises fields such as name, category, level, definition text, core/bonus skills, scenario, responsibilities, confidence, and evidence list. The fields are preferentially obtained from the statistics of the real JDs of the cluster: the high-frequency responsibility sentences feed the definition and the responsibilities; the skills with high occurrence rates feed core_skills. For the top-ranked candidates, a large language model may polish the text, with a prompt forbidding the addition of skill names absent from the evidence; in case of model failure, the heuristic result is retained. As shown in Figure 5",
# 97
"has a base confidence",
# 98
"; if its skill appears among the core skills of the discovery of this round, then",
# 99
"The prediction window is fixed, depending on the direction, at 6 to 18 months; the outputs enter the watch list for comparisons in the subsequent rescan passes.",
# 100
"Evidence audit: at least two independent evidence sources (different companies or different platforms) are required. In case of insufficient evidence, the item is marked low_evidence and enters the manual queue. It is further checked whether the definition text introduces specialized skill names outside core_skills; in case of inconsistency, a reduced weight is applied. This control separates \u201cgeneration fluency\u201d from \u201cfactual traceability\u201d [7]",
# 101
"3.8 Dynamic Evolution of the Skills of Existing Jobs",
# 102
"Skill extraction and occurrence rate: for the job category",
# 103
"the sample size",
# 104
"and the skill count",
# 105
"; we define",
# 106
"The difference is",
# 107
". The skill set is obtained by scanning the description text with the _SKILL_VOCAB dictionary, which guarantees that the two sources use the same extractor; the three-state decision rule is as follows:",
# 108
", the decision, aligned with _diff_skills in evolution_agent.py, is as follows:",
# 109
", recording the percentage of decrease.",
# 110
"and both sides are greater than 0; if",
# 111
"When the sample of a single source is insufficient, the system falls back to a weak-label output of the frequent skills of that source, declaring data_source in the response so as to avoid an empty display on the front end.",
# 112
"The relative rate of variation can be written as",
# 113
"Output and manual review: each evolution result is accompanied by the sample size, the source name, and the magnitude of the difference. For disputed items (for example, a \u201crebounding job\u201d suspected of being labeled as an addition), a historical-peak check can be performed by comparing it with the external occupational reference; if a higher peak has occurred historically, it should be marked as a rebound and not as an emerging job. This correction belongs to the operational strategy and does not affect the difference formula itself, as shown in Figure 6",
# 114
"Figure 6. Dynamic Evolution Interface of Skills",
# 115
"Problem formulation: given a set of jobs",
# 116
"quantifies the degree of matching, and an executable learning path is generated",
# 117
"to close the gaps. See Figure 7",
# 118
"Five-dimensional weighting model and notations: the total score (implemented on a 100-point scale, then truncated to",
# 119
"The weights are consistent with score_matches, and",
# 120
"the essential-skill list (ordered, possibly containing repeated semantics but normalized in the implementation),",
]
