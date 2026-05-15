# -*- coding: utf-8 -*-
from django.core.paginator import EmptyPage, PageNotAnInteger, Paginator


DEFAULT_PER_PAGE = 20
MAX_PER_PAGE = 100


def parse_positive_int(value, default):
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default
    return parsed if parsed > 0 else default


def build_page_links(page_obj, build_url=None):
    current = page_obj.number
    last = page_obj.paginator.num_pages
    if last <= 7:
        pages = list(range(1, last + 1))
    else:
        pages = [1]
        window_start = max(2, current - 1)
        window_end = min(last - 1, current + 1)
        if window_start > 2:
            pages.append(None)
        pages.extend(range(window_start, window_end + 1))
        if window_end < last - 1:
            pages.append(None)
        pages.append(last)

    links = []
    for page_number in pages:
        links.append(
            {
                "number": page_number,
                "is_gap": page_number is None,
                "is_current": page_number == current,
                "url": build_url(page_number) if page_number and build_url else "",
            }
        )
    return links


def paginate_queryset(request, queryset, default_per_page=DEFAULT_PER_PAGE, max_per_page=MAX_PER_PAGE):
    per_page = min(parse_positive_int(request.GET.get("per"), default_per_page), max_per_page)
    paginator = Paginator(queryset, per_page)
    requested_page = request.GET.get("page", 1)
    page_notice = ""

    try:
        page_obj = paginator.page(requested_page)
    except PageNotAnInteger:
        page_obj = paginator.page(1)
        page_notice = "页码无效，已为你跳转到第 1 页。"
    except EmptyPage:
        target_page = paginator.num_pages or 1
        page_obj = paginator.page(target_page)
        page_notice = f"请求的页码超出范围，已为你跳转到第 {target_page} 页。"

    params = request.GET.copy()
    params["per"] = per_page
    params.pop("page", None)

    def build_url(page_number):
        page_params = params.copy()
        page_params["page"] = page_number
        return f"{request.path}?{page_params.urlencode()}"

    pagination = {
        "has_other_pages": page_obj.has_other_pages(),
        "page_links": build_page_links(page_obj, build_url=build_url),
        "current_page": page_obj.number,
        "total_pages": paginator.num_pages,
        "per_page": per_page,
        "total_items": paginator.count,
        "start_index": page_obj.start_index() if paginator.count else 0,
        "end_index": page_obj.end_index() if paginator.count else 0,
        "prev_url": build_url(page_obj.previous_page_number()) if page_obj.has_previous() else "",
        "next_url": build_url(page_obj.next_page_number()) if page_obj.has_next() else "",
    }
    return page_obj, pagination, page_notice
