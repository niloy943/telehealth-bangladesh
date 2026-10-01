from rest_framework import permissions

class IsAdminUserRole(permissions.BasePermission):
    """
    Strict permission check: Allows access only to authenticated users 
    with role == 'admin' or Django is_staff/is_superuser flags.
    """
    message = "Admin access required. You do not have permission to access this administrative resource."

    def has_permission(self, request, view):
        return bool(
            request.user and 
            request.user.is_authenticated and 
            (getattr(request.user, 'role', None) == 'admin' or request.user.is_staff or request.user.is_superuser)
        )

class IsDoctorRole(permissions.BasePermission):
    """
    Strict permission check: Allows access only to authenticated doctors.
    """
    message = "Doctor access required. You do not have permission to access this clinical resource."

    def has_permission(self, request, view):
        return bool(
            request.user and 
            request.user.is_authenticated and 
            getattr(request.user, 'role', None) == 'doctor'
        )

class IsPatientRole(permissions.BasePermission):
    """
    Strict permission check: Allows access only to authenticated patients.
    """
    message = "Patient access required. You do not have permission to access this citizen resource."

    def has_permission(self, request, view):
        return bool(
            request.user and 
            request.user.is_authenticated and 
            getattr(request.user, 'role', None) == 'patient'
        )
