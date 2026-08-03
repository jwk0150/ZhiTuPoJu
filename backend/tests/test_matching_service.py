from pathlib import Path

from backend.matching import service


ROOT = Path(__file__).resolve().parents[2]


def test_extract_html_doc_sample():
    path = ROOT / "frontend" / "samples" / "张三_AI算法工程师_简历.doc"
    parsed = service.extract_document(path.name, path.read_bytes())
    assert parsed["extension"] == "DOC"
    assert "张三" in parsed["text"]
    assert "PyTorch" in parsed["text"]


def test_fallback_profile_extracts_real_skills():
    path = ROOT / "frontend" / "samples" / "李四_Java后端_简历.doc"
    document = service.extract_document(path.name, path.read_bytes())
    profile = service._heuristic_profile(document["text"], path.name)
    skills = {item["name"] for item in profile["skills"]}
    assert profile["name"] == "李四"
    assert profile["city"] == "上海"
    assert profile["experience_years"] > 0
    assert {"Java", "Spring Boot", "MySQL", "Redis"}.issubset(skills)


def test_java_resume_ranks_java_job_first():
    path = ROOT / "frontend" / "samples" / "李四_Java后端_简历.doc"
    document = service.extract_document(path.name, path.read_bytes())
    profile = service._heuristic_profile(document["text"], path.name)
    matches = service.score_matches(profile, reviews={})
    assert matches[0]["job"]["id"] == "job_java_backend"
    assert matches[0]["score"] >= 70


def test_gap_graph_contains_target_job():
    path = ROOT / "frontend" / "samples" / "张三_AI算法工程师_简历.doc"
    document = service.extract_document(path.name, path.read_bytes())
    profile = service._heuristic_profile(document["text"], path.name)
    match = service.score_matches(profile, reviews={})[0]
    graph = service.build_gap_graph(profile, match)
    assert any(node["id"] == "target_job" for node in graph["nodes"])
    assert any(edge["target"] == "target_job" for edge in graph["edges"])
