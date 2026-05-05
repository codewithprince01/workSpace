import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { todoApiService, ITodo, ITodoUser } from '@/api/todo/todo.api.service';

interface TodoState {
  todos: ITodo[];
  loading: boolean;
  error: string | null;
  users: ITodoUser[];
  usersLoading: boolean;
  activeView: 'my' | 'assigned';
}

const initialState: TodoState = {
  todos: [],
  loading: false,
  error: null,
  users: [],
  usersLoading: false,
  activeView: 'my',
};

export const fetchTodos = createAsyncThunk(
  'todo/fetchTodos',
  async (params: { view?: string; status?: string; priority?: string; search?: string } | undefined, { rejectWithValue }) => {
    try {
      const response = await todoApiService.getTodos(params);
      return response.body;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch todos');
    }
  }
);

export const createTodo = createAsyncThunk(
  'todo/createTodo',
  async (data: Partial<ITodo>, { rejectWithValue }) => {
    try {
      const response = await todoApiService.createTodo(data);
      return response.body;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to create todo');
    }
  }
);

export const updateTodo = createAsyncThunk(
  'todo/updateTodo',
  async ({ id, data }: { id: string; data: Partial<ITodo> }, { rejectWithValue }) => {
    try {
      const response = await todoApiService.updateTodo(id, data);
      return response.body;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to update todo');
    }
  }
);

export const deleteTodo = createAsyncThunk(
  'todo/deleteTodo',
  async (id: string, { rejectWithValue }) => {
    try {
      await todoApiService.deleteTodo(id);
      return id;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to delete todo');
    }
  }
);

export const bulkUpdateTodos = createAsyncThunk(
  'todo/bulkUpdateTodos',
  async ({ ids, data }: { ids: string[]; data: Partial<ITodo> }, { rejectWithValue }) => {
    try {
      await todoApiService.bulkUpdate(ids, data);
      return { ids, data };
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to bulk update');
    }
  }
);

export const bulkDeleteTodos = createAsyncThunk(
  'todo/bulkDeleteTodos',
  async (ids: string[], { rejectWithValue }) => {
    try {
      await todoApiService.bulkDelete(ids);
      return ids;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to bulk delete');
    }
  }
);

export const searchAssignableUsers = createAsyncThunk(
  'todo/searchUsers',
  async (q: string | undefined, { rejectWithValue }) => {
    try {
      const response = await todoApiService.searchUsers(q);
      return response.body;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to search users');
    }
  }
);

const todoSlice = createSlice({
  name: 'todo',
  initialState,
  reducers: {
    setActiveView: (state, action: PayloadAction<'my' | 'assigned'>) => {
      state.activeView = action.payload;
    },
    clearTodoError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch
      .addCase(fetchTodos.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchTodos.fulfilled, (state, action) => {
        state.loading = false;
        state.todos = action.payload;
      })
      .addCase(fetchTodos.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Create
      .addCase(createTodo.fulfilled, (state, action) => {
        state.todos.unshift(action.payload);
      })
      // Bulk Update
      .addCase(bulkUpdateTodos.fulfilled, (state, action) => {
        const { ids, data } = action.payload;
        const idSet = new Set(ids);
        state.todos = state.todos.map(todo => 
          idSet.has(todo._id) ? { ...todo, ...data } : todo
        );
      })
      // Update
      .addCase(updateTodo.fulfilled, (state, action) => {
        const index = state.todos.findIndex(t => t._id === action.payload._id);
        if (index !== -1) {
          state.todos[index] = action.payload;
        }
      })
      // Delete
      .addCase(deleteTodo.fulfilled, (state, action) => {
        state.todos = state.todos.filter(t => t._id !== action.payload);
      })
      // Bulk Delete
      .addCase(bulkDeleteTodos.fulfilled, (state, action) => {
        const idsToDelete = new Set(action.payload);
        state.todos = state.todos.filter(t => !idsToDelete.has(t._id));
      })
      // Search Users
      .addCase(searchAssignableUsers.pending, (state) => {
        state.usersLoading = true;
      })
      .addCase(searchAssignableUsers.fulfilled, (state, action) => {
        state.usersLoading = false;
        state.users = action.payload;
      })
      .addCase(searchAssignableUsers.rejected, (state) => {
        state.usersLoading = false;
      });
  },
});

export const { setActiveView, clearTodoError } = todoSlice.actions;
export default todoSlice.reducer;
