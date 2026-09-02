# -*- coding: utf-8 -*-
# NODE 121 - 170 英文翻译
TRANS_C = [
# 121
"the bonus-skill list, and",
# 122
"the candidate\u2019s skill set. Let",
# 123
"be the set of missing skills. For each missing skill",
# 124
"The score of the skill dimension (out of 100) is:",
# 125
"where",
# 126
", truncated to 100 at most. The semantic score",
# 127
"prioritizes the results of the large-language-model review and, failing that, a textual heuristic. The experience score",
# 128
"If the duration is unknown, 55 is retained. Graph score: in the presence of a transfer,",
# 129
"; otherwise, 35 is retained. If there is neither a match nor a transfer, the total score is reduced by 8 points as a penalty.",
# 130
"Gap analysis and learning path: for each missing skill, a readiness degree is defined",
# 131
"(default low value in the absence of a transfer).",
# 132
"is considered a high-priority gap. The learning path retains at most the first 4 gaps and queries the resource table to generate the weeks, the deliverables, and the impact scores",
# 133
"3.10 Dialogue with Large Language Models and Hallucination Control",
# 134
"Generation constraints and degradation: inventing job names and identifiers absent from the context is forbidden; the structured output must respect the agreed JSON fields. In case of missing API key, timeout, or parsing failure, the system switches to the responses of local models, ensuring the reproducibility of the demonstration path. For the central discovery and evolution conclusions, the system always retains a LLM-free heuristic implementation; the large language model is only responsible for editorial polishing and semantic review, reducing the risk that \u201can unavailable model makes the functionality unavailable\u201d [8], as shown in Figure 8",
# 135
"Figure 8. Comparison of Real Diagnostics Against Hallucinations",
# 136
"Hallucination limitations of large language models and retrieval-augmented generation: retrieval-augmented generation (RAG) mitigates hallucinations by providing external knowledge to the LLM, but the vector search of traditional RAG only returns semantically similar text fragments, without exploiting the structural associations between pieces of knowledge. Graph-augmented RAGs (such as GraphRAG, LightRAG) represent knowledge as a graph, but can only model pairwise relations; when the knowledge involves three or more entities, the multi-entity associations are lost, depriving the LLM of context and producing hallucinations due to knowledge gaps [9]. Moreover, errors propagate and amplify along the pairwise edges of the graph \u2014 the pairwise edges of an ordinary graph more easily propagate and amplify errors between nodes, whereas the hyperedge context can balance and suppress pointwise noise [9].",
# 137
"DCF: differentiable conformal training for the factuality of LLM reasoning [10]. ttesdorf et al. (2026) propose the Differentiable Coherent Factuality (DCF) [10], whose central elements are as follows:",
# 138
"Conformal framework: the LLM output is decomposed into several subclaims, each receiving a risk score; a calibrated threshold filters the high-risk claims, statistically guaranteeing that the hallucination rate remains below the user-specified level (for example 10%);",
# 139
"Dependency-graph modeling: the output is represented as a dependency graph, jointly validating the claims and their logical ancestors, so as to avoid \u201clater conclusions resting on unestablished premises\u201d;",
# 140
"Differentiable relaxation: the previously non-differentiable Coherent Factuality filtering process is rewritten in a differentiable form, allowing the scorer to learn directly from the data; at deployment time, the learned scorer is \u201cre-inserted\u201d into the original algorithmic flow, retaining the mathematical correctness guarantees of the initial algorithm. Experiments show that DCF, while maintaining its reliability guarantees, increases the claim retention rate by up to 141% [10].",
# 141
"3.11 Experiments and Results",
# 142
"The experiments were carried out under Windows 11, Python 3.12, PostgreSQL 15, and FastAPI 0.115; large language models are invoked via DeepSeek Chat, with an automatic fallback to the local heuristic when the API key is absent, so as to ensure the reproducibility of the central chain. The valid samples are counted on the basis of a completeness of at least 60%. The initial collection counts about 15400 postings; after deduplication, 12495 postings remain, of which 11680 are high-quality (93.5%); after further inter-source deduplication, about 11200 globally unique postings remain, the sectors being mainly Internet/IT, artificial intelligence, big data, and cloud computing. The knowledge graph thus constructed comprises about 5747 nodes and 13081 relations, of which 8234 are job-skill edges (REQUIRES).",
# 143
"The quantitative evaluation covers the three contest thresholds and two process indicators: the JD parsing accuracy is 93.9%, the resume extraction accuracy 91.0%, and the job\u2013candidate matching accuracy 92.7%, all not lower than 90%; the F1 of emerging-job discovery is 0.824, and the Kappa of consistency between the evolution and the expert annotations is 0.76. In order to avoid innovations remaining vague formulations, Table 1 maps I1\u2013I5 to the above quantified indicators and implementation modules; evaluators can thus trace, from the table, the formulas and the code paths, the actual interface being illustrated in Figure 9. For the two qualitative innovations of discovery and evolution, a comparison is further made with a frequency-based baseline and a TF-IDF new-word baseline; the results show that the gain does not amount to a simple transposition of keyword statistics. Table 1. Innovations and Corresponding Quantitative Evidence",
# 144
"Central formula / rule",
# 145
"Quantitative evidence",
# 146
"I1 Quality control",
# 147
"12495 valid, 11680 high-quality (93.5%); example 13/15\u22480.87",
# 148
"I2 Three-dimensional emergence",
# 149
"P/R/F1=0.750/0.913/0.824; case study of 77 points retained",
# 150
"I3 Pseudo-temporal differential",
# 151
"\u0394=rB\u2212rA, three-state thresholds",
# 152
"Kappa=0.76; recomputable differentials such as RAG+54 of Table 3a",
# 153
"Weighted M and transfer\u22640.65",
# 154
"Acc=0.927; removal of the skill dimension \u0394Acc=\u22120.084",
# 155
"I5 Evidence/hallucination control",
# 156
"hallucination rate 18.7%\u21923.2%; reproducible without a key via the fallback",
# 157
"Figure 9. Example of Real Job Data",
# 158
"Summary of the work: this paper, addressing topic XH-202621, translates the \u201ccross-validation of multi-source cleaning\u201d and the \u201challucination control of skills\u201d into five verifiable innovations and delivers an executable system. I1 moves the control upstream to the database insertion triggers through the fingerprint and the completeness of fifteen fields, with 93.5% high-quality records. I2 discovers emerging jobs using",
# 159
"and a six-step chain, with an F1 reaching 0.824. I3 provides additions, deletions, and modifications through multi-source occurrence-rate differences, with a Kappa of 0.76, and gives examples of recomputable differences such as RAG/Prompt. I4 achieves the diagnosis through the five-dimensional weighting",
# 160
"and the transfer upper bound",
# 161
", with an accuracy of 0.927, the ablation validating the soundness of the weights. I5 brings the hallucination rate to about 3.2% through the evidence-based control",
# 162
"and the local fallback. The three quantitative accuracies of the contest are all not lower than 90%. The value of the system lies in the fact that the innovations are formulated as equations and thresholds, supported by quantitative data, rather than remaining conceptual slogans.",
# 163
"Limitations: the data horizon is about twelve months, which does not allow correctly detecting long-cycle occupational rebounds; the pseudo-temporal approach relies on the hypothesis of penetration differences between platforms, which may become invalid in domains where the sources are updated synchronously; out-of-dictionary skills and very-low-frequency jobs still depend on manual intervention; the ethical-audit sample is limited and the fairness conclusions must be re-verified on a larger stratified sample [11].",
# 164
"Overall, the system demonstrates that it is possible to chain data quality, graph construction, discovery and evolution, and job\u2013candidate diagnosis into an executable pipeline on real recruitment corpora; its value does not lie in proposing new unreproducible \u201cblack-box\u201d scores, but in transcribing key judgments into formulas, thresholds, and verifiable logs.",
# 165
"Faced with the real difficulties of the digital-economy context \u2014 \u201cthe speed of technological iteration far exceeds the talent-training cycle, enterprises find it difficult to recruit for emerging jobs, and the career-development paths of candidates are unclear\u201d \u2014, this paper designs and implements an intelligent job-market analysis system taking the job and the skill as central entities, the knowledge graph as an organizational support, and large language models as a reasoning engine. The system loops the complete chain \u201cmulti-source data collection \u2014 new-job discovery \u2014 graph construction \u2014 dynamic evolution \u2014 job\u2013candidate matching \u2014 trend prediction\u201d, covering four business levels: data foundation, graph visualization, intelligent analysis, and job\u2013candidate diagnosis, thereby providing data-driven decision support to public authorities, enterprises, and candidates.",
# 166
"At the data level, the platform implements a distributed collection and fusion mechanism covering several recruitment platforms (anti-bot bypass with Playwright, cooperative JSONL file exchange, idempotent deduplication), forming a multi-source heterogeneous dataset comprising more than 38000 real job records. At the functional level, four core capabilities are realized: intelligent discovery of new jobs (six-step reasoning chain including hallucination detection), dynamic updating of the skills of existing jobs (pseudo-temporal evolution analysis based on a dictionary of more than 150 technical terms), panoramic graph visualization at the skill-point level (three G6 views with hover interactions, national digital talent map), and job\u2013candidate matching diagnosis (multi-format resume parsing, joint scoring by semantic distance, gap analysis, and learning-path planning). The technical innovations are mainly manifested in: fused graph-and-RAG reasoning, dual-channel fallback of the rule engine and the large language model, and hallucination control based on evidence cross-validation; a test system has been set up with, as strict acceptance criteria, JD parsing, resume extraction, and matching accuracies not lower than 90%. The system has successfully passed real end-to-end browser tests; the graph rendering, the linked interactions, and the data consistency have all been verified.",
# 167
"The platform presents concrete application value in scenarios such as career planning for candidates, recruitment decisions for enterprises, and adjustment of training directions; it can reduce to a certain extent the structural contradiction of the imbalance between talent supply and demand. In the future, it will continue to evolve in the directions of real temporal evolution analysis, large-scale automatic evaluation benchmarks, front-end industrialization, and automated-test coverage, so as to turn the system into a digital-governance infrastructure of the job market.",
# 168
"References",
# 169
"[6] Zhang Qi, Gui Tao, Zheng Rui, et al. A review of research on named entity recognition[J]. Journal of Software, 2018, 29(3): 812-831.",
# 170
"[11] Hu Xiaoyong, Huang Jie, Lin Zirou, et al. AI ethics in education: conceptual framework, cognitive state, and risk prevention[J]. Modern Distance Education Research, 2022, 34(2): 21-29.",
]
