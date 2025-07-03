## Cost analysis 

variables and constants: 

- 



Finish this when you come back. 
>>> price_per_month_512chunk_openai = []
>>>



```
❯ python
Python 3.10.12 (main, May 27 2025, 17:12:29) [GCC 11.4.0] on linux
Type "help", "copyright", "credits" or "license" for more information.
>>> import numpy as np
>>> openai_dims = 1536
>>> surus_dims = np.array([768, 512, 256, 128])
>>> token_amounts = np.array([50000, 500000, 5000000, 50000000, 500000000, 5000000000])
>>> chunk_sizes = np.array([512, 256, 128])
>>> np.set_printoptions(suppress=True, formatter={'float': '{:0.2f}'.format})
>>>

```
❯ python

```
Python 3.10.12 (main, May 27 2025, 17:12:29) [GCC 11.4.0] on linux
Type "help", "copyright", "credits" or "license" for more information.
>>> import numpy as np
>>> openai_dims = 1536
>>> surus_dims = np.array([768, 512, 256, 128])
>>> token_amounts = np.array([50000, 500000, 5000000, 50000000, 500000000, 5000000000])
>>> chunk_sizes = np.array([512, 256, 128])
>>> np.set_printoptions(suppress=True, formatter={'float': '{:0.2f}'.format})
>>> n_vectors_512chunk = token_amounts / chunk_sizes[0]
>>> n_vectors_512chunk
array([97.66, 976.56, 9765.62, 97656.25, 976562.50, 9765625.00])
>>> n_vectors_512chunk = np.ceil(np_vectors_512chunk)
Traceback (most recent call last):
  File "<stdin>", line 1, in <module>
NameError: name 'np_vectors_512chunk' is not defined. Did you mean: 'n_vectors_512chunk'?
>>> n_vectors_512chunk = np.ceil(n_vectors_512chunk)
>>> n_vectores_512chunk
Traceback (most recent call last):
  File "<stdin>", line 1, in <module>
NameError: name 'n_vectores_512chunk' is not defined. Did you mean: 'n_vectors_512chunk'?
>>> n_vectors_512chunk
array([98.00, 977.00, 9766.00, 97657.00, 976563.00, 9765625.00])
>>> n_vectors_256chunk = np.ceil(token_amounts / chunk_sizes[1])
>>> n_vectors_256chunk
array([196.00, 1954.00, 19532.00, 195313.00, 1953125.00, 19531250.00])
>>> n_vectors_128chunk = np.ceil(token/amounts / chunk_sizes[2])
Traceback (most recent call last):
  File "<stdin>", line 1, in <module>
NameError: name 'token' is not defined. Did you mean: 'open'?
>>> n_vectors_128chunk = np.ceil(token_amounts / chunk_sizes[2])
>>> n_vectors_128chunk
array([391.00, 3907.00, 39063.00, 390625.00, 3906250.00, 39062500.00])
>>>
```




```
>>> print("this gives us")
this gives us
>>> openai_dims
1536
>>> surus_dims
array([768, 512, 256, 128])
>>> token_amounts
array([     50000,     500000,    5000000,   50000000,  500000000,
       5000000000])
>>> chunk_sizes
array([512, 256, 128])
>>> n_vectors_512chunk
array([98.00, 977.00, 9766.00, 97657.00, 976563.00, 9765625.00])
>>> n_vectors_256chunk
array([196.00, 1954.00, 19532.00, 195313.00, 1953125.00, 19531250.00])
>>> n_vectors_128chunk
array([391.00, 3907.00, 39063.00, 390625.00, 3906250.00, 39062500.00])
>>>

```
