/**
 * Side-effect import barrel: pulls in every adapter so its registerAdapter()
 * call runs. Import this once before calling getAdapter() / syncExternalCalendar().
 */
import "./caldav-adapter";
import "./google-adapter";
import "./microsoft-adapter";
