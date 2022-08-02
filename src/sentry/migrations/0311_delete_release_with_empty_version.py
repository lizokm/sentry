# Generated by Django 2.2.28 on 2022-07-29 18:04
from typing import Callable, Iterable, TypeVar

from django.db import migrations

from sentry.new_migrations.migrations import CheckedMigration

ModelRow = TypeVar("ModelRow")


def delete_release_with_empty_version(apps, schema_editor):
    Release = apps.get_model("sentry", "Release")
    # tables with an explicit fk relationship to Release
    ReleaseProject = apps.get_model("sentry", "ReleaseProject")
    ReleaseProjectEnvironment = apps.get_model("sentry", "ReleaseProjectEnvironment")
    Deploy = apps.get_model("sentry", "Deploy")
    ReleaseActivity = apps.get_model("sentry", "ReleaseActivity")
    ReleaseCommit = apps.get_model("sentry", "ReleaseCommit")
    Group = apps.get_model("sentry", "Group")
    ReleaseHeadCommit = apps.get_model("sentry", "ReleaseHeadCommit")
    GroupResolution = apps.get_model("sentry", "GroupResolution")
    Distribution = apps.get_model("sentry", "GroupResolution")

    for release in Release.objects.filter(
        version="",
        project_id__isnull=True,
        date_released__isnull=True,
        ref__isnull=True,
        url__isnull=True,
        date_started__isnull=True,
        owner_id__isnull=True,
        build_code__isnull=True,
        build_number__isnull=True,
        major__isnull=True,
        minor__isnull=True,
        patch__isnull=True,
        prerelease__isnull=True,
        revision__isnull=True,
        package__isnull=True,
    ):
        params = [
            (
                ReleaseProject.objects.filter(release_id=release.id),
                lambda rp: rp.new_groups == 0 and rp.adopted is None and rp.unadopted is None,
            ),
            (
                ReleaseProjectEnvironment.objects.filter(release_id=release.id),
                lambda rpe: rpe.new_issues_count == 0 or rpe.new_issues_count is None,
            ),
            (
                Deploy.objects.filter(release_id=release.id),
                lambda d: d.date_finished is None
                and d.name is None
                and d.url is None
                and d.notified is None,
            ),
            (
                ReleaseActivity.objects.filter(release_id=release.id),
                lambda ra: ra.type is None and ra.data is None and ra.date_added is None,
            ),
            (
                ReleaseCommit.objects.filter(release_id=release.id),
                lambda rc: rc.order is None and rc.commit_id is None,
            ),
            (
                Group.objects.filter(first_release_id=release.id),
                lambda g: False,  # don't delete any Issues at all
            ),
            (
                ReleaseHeadCommit.objects.filter(release_id=release.id),
                lambda rhc: rhc.repository_id is None and rhc.commit_id is None,
            ),
            (
                GroupResolution.objects.filter(release_id=release.id),
                lambda gr: gr.group_id is None
                and gr.datetime is None
                and gr.status is None
                and gr.type is None,
            ),
            (
                Distribution.objects.filter(release_id=release.id),
                lambda d: d.name is None and d.date_added is None,
            ),
        ]

        removed_all_release_fk_references = all(
            map(lambda param: delete_release_fk_model_entries(param[0], param[1]), params)
        )

        if removed_all_release_fk_references:
            release.delete()


def delete_release_fk_model_entries(
    fk_queryset: Iterable[ModelRow], deletable_row: Callable[[ModelRow], bool]
) -> bool:
    removed_all_refs_for_release = True
    for row in fk_queryset:
        if deletable_row(row):
            row.delete()
        else:
            removed_all_refs_for_release = False

    return removed_all_refs_for_release


class Migration(CheckedMigration):
    # This flag is used to mark that a migration shouldn't be automatically run in production. For
    # the most part, this should only be used for operations where it's safe to run the migration
    # after your code has deployed. So this should not be used for most operations that alter the
    # schema of a table.
    # Here are some things that make sense to mark as dangerous:
    # - Large data migrations. Typically we want these to be run manually by ops so that they can
    #   be monitored and not block the deploy for a long period of time while they run.
    # - Adding indexes to large tables. Since this can take a long time, we'd generally prefer to
    #   have ops run this and not block the deploy. Note that while adding an index is a schema
    #   change, it's completely safe to run the operation after the code has deployed.
    is_dangerous = False

    # This flag is used to decide whether to run this migration in a transaction or not. Generally
    # we don't want to run in a transaction here, since for long running operations like data
    # back-fills this results in us locking an increasing number of rows until we finally commit.
    atomic = False

    dependencies = [
        ("sentry", "0310_sentry_functions_add_webhooks"),
    ]

    operations = [
        migrations.RunPython(
            delete_release_with_empty_version,
            migrations.RunPython.noop,
            hints={
                "tables": [
                    "sentry_release",
                    "sentry_release_project",
                    "sentry_releaseprojectenvironment",
                    "sentry_deploy",
                    "sentry_releaseactivity",
                    "sentry_releasecommit",
                    "sentry_groupedmessage",
                    "sentry_releaseheadcommit",
                    "sentry_releaseactivity",
                    "sentry_groupresolution",
                    "sentry_distribution",
                ]
            },
        ),
    ]