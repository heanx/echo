def delete_filefield_file(instance, field_name):
    field_file = getattr(instance, field_name, None)
    if not field_file:
        return
    try:
        storage = field_file.storage
        name = field_file.name
    except Exception:
        return
    if name and storage.exists(name):
        storage.delete(name)


def delete_file(storage, name):
    if name and storage.exists(name):
        storage.delete(name)


def remember_replaced_files(instance, field_names):
    if not instance.pk:
        instance._replaced_file_fields = {}
        return
    old_instance = instance.__class__.objects.filter(pk=instance.pk).first()
    if not old_instance:
        instance._replaced_file_fields = {}
        return
    replaced = {}
    for field_name in field_names:
        old_file = getattr(old_instance, field_name, None)
        new_file = getattr(instance, field_name, None)
        old_name = getattr(old_file, "name", "")
        new_name = getattr(new_file, "name", "")
        if old_name and old_name != new_name:
            replaced[field_name] = (old_file.storage, old_name)
    instance._replaced_file_fields = replaced


def delete_remembered_replaced_files(instance):
    for storage, name in getattr(instance, "_replaced_file_fields", {}).values():
        delete_file(storage, name)
    instance._replaced_file_fields = {}
