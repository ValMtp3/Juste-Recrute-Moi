from __future__ import annotations

import inspect

from fastapi import APIRouter, Depends, HTTPException

from api.dependencies import get_profile_service
from core.types import CandidateBody, ExperienceBody, IdentityBody, ProfileCleanupBody, ProfileEntryBody, ProjectBody, SkillBody
from data.graph.connection import run_graph


router = APIRouter(prefix="/api/v1", tags=["profile"])

_CANDIDATE_REQUIRED = "Ajoutez au moins un nom ou un résumé de profil."
_SKILL_REQUIRED = "Le nom de la compétence est obligatoire."
_PROJECT_REQUIRED = "Le titre du projet est obligatoire."
_EDUCATION_REQUIRED = "Le titre de la formation est obligatoire."
_CERTIFICATION_REQUIRED = "Le titre de la certification est obligatoire."
_ACHIEVEMENT_REQUIRED = "Le titre de la réalisation est obligatoire."


@router.get("/profile")
async def get_profile_endpoint(service=Depends(get_profile_service)):
    return await _call_service(service.get_profile)


@router.put("/profile/candidate")
async def update_candidate_endpoint(body: CandidateBody, service=Depends(get_profile_service)):
    if not body.n.strip() and not body.s.strip():
        raise HTTPException(status_code=422, detail=_CANDIDATE_REQUIRED)
    return await _call_service(service.update_candidate, body.n, body.s)


@router.put("/profile/identity")
async def update_identity_endpoint(body: IdentityBody, service=Depends(get_profile_service)):
    return await _call_service(service.update_identity, body.model_dump())


@router.post("/profile/cleanup")
async def cleanup_profile_endpoint(body: ProfileCleanupBody, service=Depends(get_profile_service)):
    return await _call_service(service.cleanup_profile)


@router.post("/profile/skill")
async def add_skill_endpoint(body: SkillBody, service=Depends(get_profile_service)):
    if not body.n.strip():
        raise HTTPException(status_code=422, detail=_SKILL_REQUIRED)
    return await _call_service(service.add_skill, body.n, body.cat)


@router.put("/profile/skill/{sid}")
async def update_skill_endpoint(sid: str, body: SkillBody, service=Depends(get_profile_service)):
    if not body.n.strip():
        raise HTTPException(status_code=422, detail=_SKILL_REQUIRED)
    return await _call_service(service.update_skill, sid, body.n, body.cat)


@router.delete("/profile/skill/{sid}")
async def delete_skill_endpoint(sid: str, service=Depends(get_profile_service)):
    await _call_service(service.delete_skill, sid)
    return {"ok": True}


@router.post("/profile/experience")
async def add_experience_endpoint(body: ExperienceBody, service=Depends(get_profile_service)):
    if not body.role.strip() and not body.co.strip():
        raise HTTPException(status_code=422, detail="Le poste ou l'entreprise est obligatoire")
    return await _call_service(service.add_experience, body.role, body.co, body.period, body.d)


@router.put("/profile/experience/{eid}")
async def update_experience_endpoint(eid: str, body: ExperienceBody, service=Depends(get_profile_service)):
    if not body.role.strip() and not body.co.strip():
        raise HTTPException(status_code=422, detail="Le poste ou l'entreprise est obligatoire")
    return await _call_service(service.update_experience, eid, body.role, body.co, body.period, body.d)


@router.delete("/profile/experience/{eid}")
async def delete_experience_endpoint(eid: str, service=Depends(get_profile_service)):
    await _call_service(service.delete_experience, eid)
    return {"ok": True}


@router.post("/profile/project")
async def add_project_endpoint(body: ProjectBody, service=Depends(get_profile_service)):
    if not body.title.strip():
        raise HTTPException(status_code=422, detail=_PROJECT_REQUIRED)
    return await _call_service(service.add_project, body.title, body.stack, body.repo, body.impact)


@router.put("/profile/project/{pid}")
async def update_project_endpoint(pid: str, body: ProjectBody, service=Depends(get_profile_service)):
    if not body.title.strip():
        raise HTTPException(status_code=422, detail=_PROJECT_REQUIRED)
    return await _call_service(service.update_project, pid, body.title, body.stack, body.repo, body.impact)


@router.delete("/profile/project/{pid}")
async def delete_project_endpoint(pid: str, service=Depends(get_profile_service)):
    await _call_service(service.delete_project, pid)
    return {"ok": True}


@router.post("/profile/education")
async def add_education_endpoint(body: ProfileEntryBody, service=Depends(get_profile_service)):
    if not body.title.strip():
        raise HTTPException(status_code=422, detail=_EDUCATION_REQUIRED)
    return await _call_service(service.add_education, body.title)


@router.delete("/profile/education/{entry:path}")
async def delete_education_endpoint(entry: str, service=Depends(get_profile_service)):
    await _call_service(service.delete_education, entry)
    return {"ok": True}


@router.post("/profile/certification")
async def add_certification_endpoint(body: ProfileEntryBody, service=Depends(get_profile_service)):
    if not body.title.strip():
        raise HTTPException(status_code=422, detail=_CERTIFICATION_REQUIRED)
    return await _call_service(service.add_certification, body.title)


@router.delete("/profile/certification/{entry:path}")
async def delete_certification_endpoint(entry: str, service=Depends(get_profile_service)):
    await _call_service(service.delete_certification, entry)
    return {"ok": True}


@router.post("/profile/achievement")
async def add_achievement_endpoint(body: ProfileEntryBody, service=Depends(get_profile_service)):
    if not body.title.strip():
        raise HTTPException(status_code=422, detail=_ACHIEVEMENT_REQUIRED)
    return await _call_service(service.add_achievement, body.title)


@router.delete("/profile/achievement/{entry:path}")
async def delete_achievement_endpoint(entry: str, service=Depends(get_profile_service)):
    await _call_service(service.delete_achievement, entry)
    return {"ok": True}


async def _call_service(method, *args, **kwargs):
    if inspect.iscoroutinefunction(method):
        return await method(*args, **kwargs)
    result = await run_graph(method, *args, **kwargs)
    if inspect.isawaitable(result):
        return await result
    return result
