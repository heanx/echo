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
