initCollectionPage({
    key: "women",
    gender: "women",
    pageTitle: "Women Collection",
    heroEyebrow: "WOMENSWEAR EDIT",
    heroTitle: "WOMEN COLLECTION",
    heroSubtitle: "Refined streetwear energy blending softness, edge, and modern movement.",
    heroFallbackImage: "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=1800&q=80",
    bannerType: "womenHero",
    bannerTypes: ["womenHero", "womenHero2", "womenHero3"],
    quickTypes: [
        { value: "all", label: "All" },
        { value: "tshirt", label: "T-Shirts" },
        { value: "top", label: "Tops" },
        { value: "sweatpant", label: "Sweatpants" }
    ],
    hashAliases: {
        oversized: { sectionId: "tshirts", subcategoryId: "oversized" },
        regular: { sectionId: "tshirts", subcategoryId: "regular" }
    },
    categories: [
        {
            id: "tshirts",
            navLabel: "T-Shirts",
            title: "T-Shirts",
            subtitle: "Core silhouettes with versatile fits for every day.",
            type: "tshirt",
            cardAliases: ["oversized", "regular"],
            subcategories: [
                {
                    id: "all",
                    navLabel: "All Fits",
                    title: "T-Shirts",
                    subtitle: "Explore every fit in the women's t-shirt lineup."
                },
                {
                    id: "oversized",
                    navLabel: "Oversized",
                    title: "Oversized T-Shirts",
                    subtitle: "Loose and expressive silhouettes with effortless drape.",
                    fit: "oversized"
                },
                {
                    id: "regular",
                    navLabel: "Regular",
                    title: "Regular T-Shirts",
                    subtitle: "Sharp basics for clean everyday styling.",
                    fit: "regular"
                }
            ]
        },
        {
            id: "tops",
            navLabel: "Tops",
            title: "Tops",
            subtitle: "Elevated essentials with polished femininity.",
            type: "top"
        },
        {
            id: "sweatpants",
            navLabel: "Sweatpants",
            title: "Sweatpants",
            subtitle: "Soft comfort made for all-day wear and travel.",
            type: "sweatpant"
        }
    ]
})
