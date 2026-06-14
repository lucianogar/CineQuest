import { AppState, Platform } from 'react-native';
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

const AsyncStorageAdapter = {
  getItem: (key: string) => {
    if (Platform.OS === 'web' && typeof window === 'undefined') return Promise.resolve(null);
    return AsyncStorage.getItem(key);
  },
  setItem: (key: string, value: string) => {
    if (Platform.OS === 'web' && typeof window === 'undefined') return Promise.resolve();
    return AsyncStorage.setItem(key, value);
  },
  removeItem: (key: string) => {
    if (Platform.OS === 'web' && typeof window === 'undefined') return Promise.resolve();
    return AsyncStorage.removeItem(key);
  },
};

// Cliente Supabase Real
export const rawSupabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    rawSupabase.auth.startAutoRefresh();
  } else {
    rawSupabase.auth.stopAutoRefresh();
  }
});

// Chave local para o AsyncStorage
const getLocalKey = (table: string) => `@local_table_${table}`;

// Implementação do QueryBuilder simulando o Postgrest do Supabase
class QueryBuilder {
  table: string;
  method: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
  fields: any = null;
  options: any = null;
  filters: { type: 'eq' | 'neq' | 'in'; column: string; value?: any; values?: any[] }[] = [];
  orderSpecs: { column: string; options?: { ascending?: boolean; nullsFirst?: boolean } }[] = [];
  updateData: any = null;
  isSingle: boolean = false;

  constructor(table: string) {
    this.table = table;
  }

  select(fields?: string, options?: any) {
    this.method = 'select';
    this.fields = fields;
    this.options = options;
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push({ type: 'eq', column, value });
    return this;
  }

  neq(column: string, value: any) {
    this.filters.push({ type: 'neq', column, value });
    return this;
  }

  in(column: string, values: any[]) {
    this.filters.push({ type: 'in', column, values });
    return this;
  }

  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }) {
    this.orderSpecs.push({ column, options });
    return this;
  }

  insert(data: any) {
    this.method = 'insert';
    this.updateData = data;
    return this;
  }

  upsert(data: any, options?: any) {
    this.method = 'upsert';
    this.updateData = data;
    this.options = options;
    return this;
  }

  update(data: any) {
    this.method = 'update';
    this.updateData = data;
    return this;
  }

  delete() {
    this.method = 'delete';
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  // Suporte a Promises para uso com await
  async then(onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) {
    try {
      const res = await this.execute();
      if (onfulfilled) return onfulfilled(res);
      return res;
    } catch (err) {
      if (onrejected) return onrejected(err);
      throw err;
    }
  }

  async execute() {
    const sessionRes = await rawSupabase.auth.getSession();
    const session = sessionRes.data.session;

    if (session) {
      // ONLINE: Executa no Supabase real
      let query = rawSupabase.from(this.table) as any;
      if (this.method === 'select') {
        query = query.select(this.fields, this.options);
      } else if (this.method === 'insert') {
        query = query.insert(this.updateData);
      } else if (this.method === 'upsert') {
        query = query.upsert(this.updateData, this.options);
      } else if (this.method === 'update') {
        query = query.update(this.updateData);
      } else if (this.method === 'delete') {
        query = query.delete();
      }

      for (const f of this.filters) {
        if (f.type === 'eq') query = query.eq(f.column, f.value);
        if (f.type === 'neq') query = query.neq(f.column, f.value);
        if (f.type === 'in') query = query.in(f.column, f.values);
      }

      for (const ord of this.orderSpecs) {
        query = query.order(ord.column, ord.options);
      }

      if (this.isSingle) {
        query = query.single();
      }

      return await query;
    } else {
      // OFFLINE: Executa no AsyncStorage local
      return await executeOffline(this);
    }
  }
}

// Implementação local dos métodos Postgrest no AsyncStorage
const executeOffline = async (builder: QueryBuilder) => {
  try {
    const key = getLocalKey(builder.table);
    const json = await AsyncStorage.getItem(key);
    let list = json ? JSON.parse(json) : [];

    if (builder.method === 'select') {
      let filtered = [...list];

      // Aplicar filtros
      for (const f of builder.filters) {
        if (f.column === 'user_id') continue; // Desconsidera filtro de user_id no local
        
        if (f.type === 'eq') {
          filtered = filtered.filter((item: any) => String(item[f.column]) === String(f.value));
        } else if (f.type === 'neq') {
          filtered = filtered.filter((item: any) => String(item[f.column]) !== String(f.value));
        } else if (f.type === 'in') {
          const stringValues = (f.values || []).map((v: any) => String(v));
          filtered = filtered.filter((item: any) => stringValues.includes(String(item[f.column])));
        }
      }

      // Ordenações encadeadas
      if (builder.orderSpecs.length > 0) {
        filtered.sort((a: any, b: any) => {
          for (const ord of builder.orderSpecs) {
            const col = ord.column;
            const asc = ord.options?.ascending !== false;
            const valA = a[col];
            const valB = b[col];

            if (valA === valB) continue;

            const nullsFirst = ord.options?.nullsFirst;
            if (valA === null || valA === undefined) {
              return nullsFirst ? -1 : 1;
            }
            if (valB === null || valB === undefined) {
              return nullsFirst ? 1 : -1;
            }

            if (typeof valA === 'number' && typeof valB === 'number') {
              return asc ? valA - valB : valB - valA;
            }

            const comp = String(valA).localeCompare(String(valB));
            if (comp !== 0) {
              return asc ? comp : -comp;
            }
          }
          return 0;
        });
      }

      if (builder.isSingle) {
        if (filtered.length === 0) {
          return { data: null, error: { code: 'PGRST116', message: 'Nenhum registro encontrado' }, count: 0 };
        }
        return { data: filtered[0], error: null, count: 1 };
      }

      return { data: filtered, error: null, count: filtered.length };
    }

    if (builder.method === 'insert') {
      const dataArray = Array.isArray(builder.updateData) ? builder.updateData : [builder.updateData];
      const newItems = dataArray.map((item: any) => ({
        id: item.id || Math.random().toString(36).substring(2, 9),
        ...item,
        added_at: item.added_at || new Date().toISOString(),
      }));

      list.push(...newItems);
      await AsyncStorage.setItem(key, JSON.stringify(list));
      return { data: Array.isArray(builder.updateData) ? newItems : newItems[0], error: null };
    }

    if (builder.method === 'upsert') {
      const dataArray = Array.isArray(builder.updateData) ? builder.updateData : [builder.updateData];
      const newItems: any[] = [];

      for (const item of dataArray) {
        let index = -1;
        if (builder.table === 'user_episodes') {
          index = list.findIndex((x: any) => 
            String(x.series_id) === String(item.series_id) && 
            String(x.season_number) === String(item.season_number) && 
            String(x.episode_number) === String(item.episode_number)
          );
        } else if (builder.table === 'user_preferences') {
          index = 0; // Preferência é sempre registro único no local
        } else {
          index = list.findIndex((x: any) => String(x.movie_id) === String(item.movie_id) && x.status === item.status);
        }

        const record = {
          id: item.id || (index >= 0 ? list[index].id : Math.random().toString(36).substring(2, 9)),
          ...item,
          added_at: item.added_at || new Date().toISOString(),
        };

        if (index >= 0) {
          list[index] = record;
        } else {
          list.push(record);
        }
        newItems.push(record);
      }

      await AsyncStorage.setItem(key, JSON.stringify(list));
      return { data: Array.isArray(builder.updateData) ? newItems : newItems[0], error: null };
    }

    if (builder.method === 'update') {
      let updatedCount = 0;
      list = list.map((item: any) => {
        let matches = true;
        for (const f of builder.filters) {
          if (f.column === 'user_id') continue;
          if (f.type === 'eq' && String(item[f.column]) !== String(f.value)) matches = false;
          if (f.type === 'neq' && String(item[f.column]) === String(f.value)) matches = false;
          if (f.type === 'in' && !(f.values || []).map((v: any) => String(v)).includes(String(item[f.column]))) matches = false;
        }
        if (matches) {
          updatedCount++;
          return { ...item, ...builder.updateData };
        }
        return item;
      });

      await AsyncStorage.setItem(key, JSON.stringify(list));
      return { data: list, error: null, count: updatedCount };
    }

    if (builder.method === 'delete') {
      let deletedCount = 0;
      const remaining = list.filter((item: any) => {
        let matches = true;
        for (const f of builder.filters) {
          if (f.column === 'user_id') continue;
          if (f.type === 'eq' && String(item[f.column]) !== String(f.value)) matches = false;
          if (f.type === 'neq' && String(item[f.column]) === String(f.value)) matches = false;
          if (f.type === 'in' && !(f.values || []).map((v: any) => String(v)).includes(String(item[f.column]))) matches = false;
        }
        if (matches) {
          deletedCount++;
          return false; // remove
        }
        return true; // mantém
      });

      await AsyncStorage.setItem(key, JSON.stringify(remaining));
      return { data: remaining, error: null, count: deletedCount };
    }

    return { data: null, error: { message: 'Método não suportado' } };
  } catch (e: any) {
    console.error('Erro no banco offline:', e);
    return { data: null, error: { message: e.message } };
  }
};

// Proxy que expõe a mesma API original do Supabase Client
export const supabase = {
  auth: rawSupabase.auth,
  from: (table: string) => new QueryBuilder(table),
};
