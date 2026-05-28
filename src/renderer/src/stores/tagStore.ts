import { create } from 'zustand'

interface TagStore {
  tags: string[]
  loading: boolean
  fetchTags: () => Promise<void>
}

export const useTagStore = create<TagStore>((set) => ({
  tags: [],
  loading: false,

  fetchTags: async () => {
    set({ loading: true })
    try {
      const tags = await window.api.tag.all()
      set({ tags })
    } catch {
      // non-critical
    } finally {
      set({ loading: false })
    }
  }
}))
