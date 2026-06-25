"""Façade for the profile graph layer.

The implementation is split across focused modules:

- profile_base         shared primitives + low-level Kùzu/vector I/O wrappers
- profile_deletions    soft-delete tombstones + read-path deletion filtering
- profile_vectors      LanceDB read/write/embed + per-entity embedding text
- profile_read         profile read/merge + snapshot load/save/refresh
- profile_correlations bulk maintenance: purge / vector-sync / rebuild
- profile_mutations    create/update/delete + edge-linking + materialize

This module re-exports their public API so existing
`from data.graph.profile import X` imports keep working unchanged.
"""

from __future__ import annotations

from data.graph.profile_base import (
    IDENTITY_KEYS as IDENTITY_KEYS,
    PROFILE_DELETE_KEYS as PROFILE_DELETE_KEYS,
    PROFILE_DELETIONS_KEY as PROFILE_DELETIONS_KEY,
    PROFILE_SNAPSHOT_KEY as PROFILE_SNAPSHOT_KEY,
    _bulk_import_active as _bulk_import_active,
    _dedupe_ids as _dedupe_ids,
    _entry_key as _entry_key,
    _entry_text as _entry_text,
    _norm_key as _norm_key,
    _query_rows as _query_rows,
    _safe_execute as _safe_execute,
    _upsert_node as _upsert_node,
    _vec as _vec,
    bulk_profile_import as bulk_profile_import,
    clean_profile_summary as clean_profile_summary,
    empty_profile as empty_profile,
    hash_id as hash_id,
    normal_profile as normal_profile,
    profile_has_data as profile_has_data,
    profile_has_structured_data as profile_has_structured_data,
    project_stack_list as project_stack_list,
    stack_list as stack_list,
)
from data.graph.profile_deletions import (
    _delete_tokens as _delete_tokens,
    _forget_profile_deletion as _forget_profile_deletion,
    _is_deleted as _is_deleted,
    _load_profile_deletions as _load_profile_deletions,
    _remember_profile_deletion as _remember_profile_deletion,
    _save_profile_deletions as _save_profile_deletions,
    apply_profile_deletions as apply_profile_deletions,
    filter_embedding_deletions as filter_embedding_deletions,
    filter_graph_deletions as filter_graph_deletions,
    forget_profile_deletions_for_profile as forget_profile_deletions_for_profile,
)
from data.graph.profile_vectors import (
    _normalize_table_names as _normalize_table_names,
    add_candidate_vec as add_candidate_vec,
    add_credential_vec as add_credential_vec,
    add_experience_vec as add_experience_vec,
    add_profile_vec as add_profile_vec,
    add_project_vec as add_project_vec,
    add_skill_vec as add_skill_vec,
    credential_text as credential_text,
    delete_vec_id_from_all as delete_vec_id_from_all,
    delete_vec_rows as delete_vec_rows,
    drop_profile_aggregate_vector as drop_profile_aggregate_vector,
    embed_rows as embed_rows,
    experience_text as experience_text,
    profile_text as profile_text,
    project_text as project_text,
    prune_bad_vector_rows as prune_bad_vector_rows,
    put_vec_rows as put_vec_rows,
    read_profile_from_vectors as read_profile_from_vectors,
    skill_text as skill_text,
    vec_table_names as vec_table_names,
)
from data.graph.profile_read import (
    get_profile as get_profile,
    load_profile_snapshot as load_profile_snapshot,
    merge_profiles as merge_profiles,
    read_profile_from_graph as read_profile_from_graph,
    refresh_profile_snapshot as refresh_profile_snapshot,
    save_profile_snapshot as save_profile_snapshot,
)
from data.graph.profile_correlations import (
    purge_profile_deletion_tombstones as purge_profile_deletion_tombstones,
    rebuild_profile_correlations as rebuild_profile_correlations,
    sync_vectors_from_graph as sync_vectors_from_graph,
)
from data.graph.profile_mutations import (
    _add_text_node as _add_text_node,
    _candidate_id as _candidate_id,
    _delete_text_node as _delete_text_node,
    _experience_delete_ids as _experience_delete_ids,
    _link_experience_skills as _link_experience_skills,
    _link_project_skills as _link_project_skills,
    _link_to_candidate as _link_to_candidate,
    _project_delete_ids as _project_delete_ids,
    _refresh_after_write as _refresh_after_write,
    _save_profile_patch as _save_profile_patch,
    _skill_delete_ids as _skill_delete_ids,
    _skill_rows_by_name as _skill_rows_by_name,
    _text_node_ids as _text_node_ids,
    _unlink_outgoing as _unlink_outgoing,
    add_achievement as add_achievement,
    add_certification as add_certification,
    add_education as add_education,
    add_experience as add_experience,
    add_project as add_project,
    add_skill as add_skill,
    delete_achievement as delete_achievement,
    delete_certification as delete_certification,
    delete_education as delete_education,
    delete_experience as delete_experience,
    delete_project as delete_project,
    delete_skill as delete_skill,
    materialize_profile_snapshot as materialize_profile_snapshot,
    update_candidate as update_candidate,
    update_experience as update_experience,
    update_identity as update_identity,
    update_project as update_project,
    update_skill as update_skill,
)
